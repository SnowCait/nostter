import type { Event } from 'nostr-tools';
import type { ListContentDecrypter } from '$lib/List';
import { findIdentifier } from '$lib/nostr/protocol/event-address';
import { shouldReplaceCurrentEvent } from '$lib/nostr/protocol/replaceable-event';
import { prepareKindMuteState, type KindMuteState } from '../domain/mute-state';
import { prepareKindMuteStateFromEvent } from './prepare-mute-state';

type Candidate = { readonly event: Event; readonly identity: symbol };
type Runtime = {
	readonly owner: string | undefined;
	readonly canonical: ReadonlyMap<number, KindMuteState>;
	readonly candidates: ReadonlyMap<number, Candidate>;
};

let runtime = $state.raw<Runtime>({
	owner: undefined,
	canonical: new Map(),
	candidates: new Map()
});

function copyEvent(event: Event): Event {
	return { ...event, tags: event.tags.map((tag) => [...tag]) };
}

function copyState(state: KindMuteState): KindMuteState {
	return { event: copyEvent(state.event), pubkeys: new Set(state.pubkeys) };
}

function muteKindOf(event: Event): number | undefined {
	const identifier = findIdentifier(event.tags);
	if (identifier === undefined || !/^\d+$/.test(identifier)) return undefined;
	const muteKind = Number(identifier);
	return Number.isSafeInteger(muteKind) ? muteKind : undefined;
}

export function getKindMuteState(muteKind: number): KindMuteState | undefined {
	const state = runtime.canonical.get(muteKind);
	return state === undefined ? undefined : copyState(state);
}

export function getMutedPubkeysByKindMap(): Map<number, Set<string>> {
	return new Map(
		[...runtime.canonical].map(([muteKind, state]) => [muteKind, new Set(state.pubkeys)])
	);
}

export function isKindMutedPubkey(muteKind: number, pubkey: string): boolean {
	return runtime.canonical.get(muteKind)?.pubkeys.has(pubkey) ?? false;
}

export function applyKindMuteInitialization(
	owner: string,
	snapshot: ReadonlyMap<number, KindMuteState>
): void {
	const current = runtime;
	if (current.owner !== owner) {
		runtime = {
			owner,
			canonical: new Map([...snapshot].map(([kind, state]) => [kind, copyState(state)])),
			candidates: new Map()
		};
		return;
	}
	const canonical = new Map(current.canonical);
	const candidates = new Map(current.candidates);
	for (const [kind, state] of snapshot) {
		if (
			state.event.pubkey !== owner ||
			state.event.kind !== 30007 ||
			muteKindOf(state.event) !== kind
		)
			continue;
		const previous = canonical.get(kind);
		if (previous !== undefined && !shouldReplaceCurrentEvent(state.event, previous.event))
			continue;
		canonical.set(kind, copyState(state));
		const candidate = candidates.get(kind);
		if (candidate !== undefined && !shouldReplaceCurrentEvent(candidate.event, state.event)) {
			candidates.delete(kind);
		}
	}
	runtime = { ...current, canonical, candidates };
}

export function completeLocalKindMute(
	owner: string,
	muteKind: number,
	event: Event,
	privateTags: string[][]
): void {
	const current = runtime;
	if (
		current.owner !== owner ||
		event.pubkey !== owner ||
		event.kind !== 30007 ||
		muteKindOf(event) !== muteKind
	)
		return;
	const previous = current.canonical.get(muteKind);
	if (
		previous !== undefined &&
		previous.event.id !== event.id &&
		!shouldReplaceCurrentEvent(event, previous.event)
	)
		return;
	const canonical = new Map(current.canonical);
	canonical.set(muteKind, copyState(prepareKindMuteState(event, privateTags)));
	const candidates = new Map(current.candidates);
	const candidate = candidates.get(muteKind);
	if (candidate !== undefined && !shouldReplaceCurrentEvent(candidate.event, event)) {
		candidates.delete(muteKind);
	}
	runtime = { ...current, canonical, candidates };
}

export async function ingestRemoteKindMute(
	owner: string,
	event: Event,
	decrypt?: ListContentDecrypter
): Promise<void> {
	const muteKind = event.kind === 30007 ? muteKindOf(event) : undefined;
	const current = runtime;
	if (muteKind === undefined || current.owner !== owner || event.pubkey !== owner) return;
	const canonical = current.canonical.get(muteKind);
	if (canonical !== undefined && !shouldReplaceCurrentEvent(event, canonical.event)) return;
	const pending = current.candidates.get(muteKind);
	if (pending !== undefined && !shouldReplaceCurrentEvent(event, pending.event)) return;
	const candidate: Candidate = { event: copyEvent(event), identity: Symbol() };
	const candidates = new Map(current.candidates);
	candidates.set(muteKind, candidate);
	runtime = { ...current, candidates };
	let prepared: KindMuteState;
	try {
		prepared = await prepareKindMuteStateFromEvent(event, decrypt);
	} catch (error) {
		const latest = runtime;
		if (
			latest.owner === owner &&
			latest.candidates.get(muteKind)?.identity === candidate.identity
		) {
			const remaining = new Map(latest.candidates);
			remaining.delete(muteKind);
			runtime = { ...latest, candidates: remaining };
		}
		throw error;
	}
	const latest = runtime;
	if (latest.owner !== owner || latest.candidates.get(muteKind)?.identity !== candidate.identity)
		return;
	const previous = latest.canonical.get(muteKind);
	const remaining = new Map(latest.candidates);
	remaining.delete(muteKind);
	if (previous !== undefined && !shouldReplaceCurrentEvent(event, previous.event)) {
		runtime = { ...latest, candidates: remaining };
		return;
	}
	const updated = new Map(latest.canonical);
	updated.set(muteKind, copyState(prepared));
	runtime = { ...latest, canonical: updated, candidates: remaining };
}

export function resetKindMute(): void {
	runtime = { owner: undefined, canonical: new Map(), candidates: new Map() };
}
