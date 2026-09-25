import type { Event } from 'nostr-tools';
import { getTagValues } from '$lib/nostr/protocol/event-tags';

export type PreparedMuteTags = {
	readonly pubkeys: readonly string[];
	readonly eventIds: readonly string[];
	readonly words: readonly string[];
};

export type RegularMuteState = {
	readonly event: Event | undefined;
	readonly tags: PreparedMuteTags;
};

export type KindMuteState = {
	readonly event: Event;
	readonly pubkeys: ReadonlySet<string>;
};

export function prepareMuteTags(tags: string[][], accountPubkey: string): PreparedMuteTags {
	return {
		pubkeys: [...new Set(getTagValues('p', tags).filter((pubkey) => pubkey !== accountPubkey))],
		eventIds: [...new Set(getTagValues('e', tags))],
		words: [...new Set(getTagValues('word', tags))]
	};
}

export function prepareRegularMuteState(
	event: Event | undefined,
	accountPubkey: string,
	privateTags: string[][] = []
): RegularMuteState {
	return {
		event,
		tags: prepareMuteTags([...(event?.tags ?? []), ...privateTags], accountPubkey)
	};
}

export function prepareKindMuteState(event: Event, privateTags: string[][] = []): KindMuteState {
	return { event, pubkeys: new Set(getTagValues('p', [...event.tags, ...privateTags])) };
}
