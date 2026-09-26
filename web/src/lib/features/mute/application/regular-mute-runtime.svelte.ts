import type { Event } from 'nostr-tools';
import escapeStringRegexp from 'escape-string-regexp';
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
let runtime = $state.raw<Runtime>({
	owner: undefined,
	canonical: empty(undefined),
	candidate: undefined,
	optimistic: undefined,
	revision: 0
});
const effectiveTags = $derived(runtime.optimistic?.tags ?? runtime.canonical.tags);
const mutedPubkeys = $derived(new Set(effectiveTags.pubkeys));
const mutedEventIds = $derived(new Set(effectiveTags.eventIds));
const mutedWordsPattern = $derived(
	effectiveTags.words.length > 0
		? new RegExp(
				`(${effectiveTags.words.map((word) => escapeStringRegexp(word)).join('|')})`,
				'i'
			)
		: undefined
);

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

export function getCanonicalMuteState(): RegularMuteState {
	return copyState(runtime.canonical);
}

export function getCanonicalMuteEvent(): Event | undefined {
	return copyEvent(runtime.canonical.event);
}

export function getEffectiveMuteTags(): PreparedMuteTags {
	return copyTags(effectiveTags);
}

export function isRegularMutedPubkey(pubkey: string): boolean {
	return mutedPubkeys.has(pubkey);
}

export function isRegularMutedEventId(id: string): boolean {
	return mutedEventIds.has(id);
}

export function isRegularMutedWord(content: string): boolean {
	return mutedWordsPattern?.test(content) ?? false;
}

export function regularMuteRevision(): number {
	return runtime.revision;
}

export function applyRegularMuteInitialization(
	owner: string,
	snapshot: RegularMuteState,
	baseline: number
): void {
	const current = runtime;
	if (current.owner !== owner) {
		runtime = {
			owner,
			canonical: copyState(snapshot),
			candidate: undefined,
			optimistic: undefined,
			revision: current.revision + 1
		};
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
		runtime = {
			...current,
			canonical: copyState(snapshot),
			candidate: undefined,
			revision: current.revision + 1
		};
	} else {
		runtime = {
			...current,
			canonical: copyState(snapshot),
			candidate,
			revision: current.revision + 1
		};
	}
}

export function startOptimisticMute(owner: string, tags: PreparedMuteTags): object | undefined {
	const current = runtime;
	if (current.owner !== owner) return undefined;
	const token = {};
	runtime = { ...current, optimistic: { token, tags: copyTags(tags) } };
	return token;
}

export function clearOptimisticMute(owner: string, token: object | undefined): void {
	const current = runtime;
	if (token !== undefined && current.owner === owner && current.optimistic?.token === token) {
		runtime = { ...current, optimistic: undefined };
	}
}

export function completeLocalMute(
	owner: string,
	event: Event,
	privateTags: string[][],
	token: object | undefined
): void {
	const current = runtime;
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
	runtime = {
		...current,
		canonical: copyState(canonical),
		candidate,
		optimistic: current.optimistic?.token === token ? undefined : current.optimistic,
		revision: canonical === current.canonical ? current.revision : current.revision + 1
	};
}

export async function ingestRemoteMute(
	owner: string,
	event: Event,
	decrypt?: ListContentDecrypter
): Promise<void> {
	const current = runtime;
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
	runtime = { ...current, candidate };
	let prepared: RegularMuteState;
	try {
		prepared = await prepareRegularMuteStateFromEvent(event, owner, decrypt);
	} catch (error) {
		const latest = runtime;
		if (latest.owner === owner && latest.candidate?.identity === candidate.identity) {
			runtime = { ...latest, candidate: undefined };
		}
		throw error;
	}
	const latest = runtime;
	if (
		latest.owner !== owner ||
		latest.candidate?.identity !== candidate.identity ||
		(latest.canonical.event !== undefined &&
			!shouldReplaceCurrentEvent(event, latest.canonical.event))
	)
		return;
	runtime = {
		...latest,
		canonical: copyState(prepared),
		candidate: undefined,
		revision: latest.revision + 1
	};
}

export function resetRegularMute(): void {
	const current = runtime;
	runtime = {
		owner: undefined,
		canonical: empty(undefined),
		candidate: undefined,
		optimistic: undefined,
		revision: current.revision + 1
	};
}
