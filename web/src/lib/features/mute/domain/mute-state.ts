import type { Event } from 'nostr-tools';
import { filterTags } from '$lib/EventHelper';

export type PreparedMuteTags = {
	pubkeys: string[];
	eventIds: string[];
	words: string[];
};

export type RegularMuteState = {
	event: Event | undefined;
	tags: PreparedMuteTags;
};

export type KindMuteState = {
	event: Event;
	pubkeys: ReadonlySet<string>;
};

export function prepareMuteTags(tags: string[][], accountPubkey: string): PreparedMuteTags {
	return {
		pubkeys: [...new Set(filterTags('p', tags).filter((pubkey) => pubkey !== accountPubkey))],
		eventIds: [...new Set(filterTags('e', tags))],
		words: [...new Set(filterTags('word', tags))]
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
	return { event, pubkeys: new Set(filterTags('p', [...event.tags, ...privateTags])) };
}
