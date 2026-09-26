import { derived, get, writable } from 'svelte/store';
import type { Event } from 'nostr-tools';
import type { ListContentDecrypter } from '$lib/List';
import { shouldReplaceCurrentEvent } from '$lib/nostr/protocol/replaceable-event';
import { prepareRegularMuteStateFromEvent } from './prepare-mute-state';
import {
	prepareRegularMuteState,
	type PreparedMuteTags,
	type RegularMuteState
} from '../domain/mute-state';

type Candidate = { readonly event: Event; readonly identity: object };
type OptimisticMuteState = { readonly token: object; readonly tags: PreparedMuteTags };
type Runtime = {
	readonly owner: string | undefined;
	readonly canonical: RegularMuteState;
	readonly candidate: Candidate | undefined;
	readonly optimistic: OptimisticMuteState | undefined;
	readonly revision: number;
};

const empty = (owner: string | undefined) => prepareRegularMuteState(undefined, owner ?? '');
const runtime = writable<Runtime>({
	owner: undefined,
	canonical: empty(undefined),
	candidate: undefined,
	optimistic: undefined,
	revision: 0
});

const copyTags = (tags: PreparedMuteTags): PreparedMuteTags => ({
	pubkeys: [...tags.pubkeys],
	eventIds: [...tags.eventIds],
	words: [...tags.words]
});
const copyEvent = (event: Event | undefined): Event | undefined =>
	event === undefined
		? undefined
		: {
				...event,
				tags: event.tags.map((tag) => [...tag])
			};
const copyState = (state: RegularMuteState): RegularMuteState => ({
	event: copyEvent(state.event),
	tags: copyTags(state.tags)
});

export const canonicalMuteState = derived(runtime, ({ canonical }) => copyState(canonical));
export const muteEvent = derived(runtime, ({ canonical }) => copyEvent(canonical.event));
export const mutePubkeys = derived(runtime, ({ canonical, optimistic }) => [
	...(optimistic?.tags ?? canonical.tags).pubkeys
]);
export const muteEventIds = derived(runtime, ({ canonical, optimistic }) => [
	...(optimistic?.tags ?? canonical.tags).eventIds
]);
export const muteWords = derived(runtime, ({ canonical, optimistic }) => [
	...(optimistic?.tags ?? canonical.tags).words
]);

export function regularMuteRevision(): number {
	return get(runtime).revision;
}

export function applyRegularMuteInitialization(
	owner: string,
	snapshot: RegularMuteState,
	baseline: number
): void {
	const current = get(runtime);
	if (current.owner !== owner) {
		runtime.set({
			owner,
			canonical: copyState(snapshot),
			candidate: undefined,
			optimistic: undefined,
			revision: current.revision + 1
		});
		return;
	}
	if (current.revision !== baseline && snapshot.event === undefined) return;
	if (
		snapshot.event !== undefined &&
		current.canonical.event !== undefined &&
		!shouldReplaceCurrentEvent(snapshot.event, current.canonical.event)
	)
		return;
	if (snapshot.event === undefined && current.canonical.event !== undefined) return;
	if (snapshot.event?.id === current.canonical.event?.id) return;
	const candidate =
		current.candidate?.event.id === snapshot.event?.id ? undefined : current.candidate;
	// An initialization snapshot is already fully materialized.
	if (
		candidate !== undefined &&
		snapshot.event !== undefined &&
		!shouldReplaceCurrentEvent(candidate.event, snapshot.event)
	) {
		runtime.set({
			...current,
			canonical: copyState(snapshot),
			candidate: undefined,
			revision: current.revision + 1
		});
	} else {
		runtime.set({
			...current,
			canonical: copyState(snapshot),
			candidate,
			revision: current.revision + 1
		});
	}
}

export function startOptimisticMute(owner: string, tags: PreparedMuteTags): object | undefined {
	const current = get(runtime);
	if (current.owner !== owner) return undefined;
	const token = {};
	runtime.set({ ...current, optimistic: { token, tags: copyTags(tags) } });
	return token;
}

export function clearOptimisticMute(owner: string, token: object | undefined): void {
	const current = get(runtime);
	if (token !== undefined && current.owner === owner && current.optimistic?.token === token) {
		runtime.set({ ...current, optimistic: undefined });
	}
}

export function completeLocalMute(
	owner: string,
	event: Event,
	privateTags: string[][],
	token: object | undefined
): void {
	const current = get(runtime);
	if (current.owner !== owner) return;
	const canonical =
		current.canonical.event === undefined ||
		current.canonical.event.id === event.id ||
		shouldReplaceCurrentEvent(event, current.canonical.event)
			? prepareRegularMuteState(event, owner, privateTags)
			: current.canonical;
	const candidate =
		current.candidate !== undefined &&
		!shouldReplaceCurrentEvent(current.candidate.event, event)
			? undefined
			: current.candidate;
	runtime.set({
		...current,
		canonical: copyState(canonical),
		candidate,
		optimistic: current.optimistic?.token === token ? undefined : current.optimistic,
		revision: canonical === current.canonical ? current.revision : current.revision + 1
	});
}

export async function ingestRemoteMute(
	owner: string,
	event: Event,
	decrypt?: ListContentDecrypter
): Promise<void> {
	const current = get(runtime);
	if (current.owner !== owner || event.pubkey !== owner) return;
	if (
		current.canonical.event !== undefined &&
		!shouldReplaceCurrentEvent(event, current.canonical.event)
	)
		return;
	if (
		current.candidate !== undefined &&
		!shouldReplaceCurrentEvent(event, current.candidate.event)
	)
		return;
	const candidate = { event: copyEvent(event)!, identity: {} };
	runtime.set({ ...current, candidate });
	let prepared: RegularMuteState;
	try {
		prepared = await prepareRegularMuteStateFromEvent(event, owner, decrypt);
	} catch (error) {
		const latest = get(runtime);
		if (latest.owner === owner && latest.candidate?.identity === candidate.identity) {
			runtime.set({ ...latest, candidate: undefined });
		}
		throw error;
	}
	const latest = get(runtime);
	if (
		latest.owner !== owner ||
		latest.candidate?.identity !== candidate.identity ||
		(latest.canonical.event !== undefined &&
			!shouldReplaceCurrentEvent(event, latest.canonical.event))
	)
		return;
	runtime.set({
		...latest,
		canonical: copyState(prepared),
		candidate: undefined,
		revision: latest.revision + 1
	});
}

export function resetRegularMute(): void {
	const current = get(runtime);
	runtime.set({
		owner: undefined,
		canonical: empty(undefined),
		candidate: undefined,
		optimistic: undefined,
		revision: current.revision + 1
	});
}
