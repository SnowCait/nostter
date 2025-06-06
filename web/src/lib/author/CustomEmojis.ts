import { get, writable } from 'svelte/store';
import { createRxBackwardReq, latestEach, uniq, type LazyFilter } from 'rx-nostr';
import { filter } from 'rxjs';
import type { Event } from 'nostr-typedef';
import { chunk } from '$lib/Array';
import { maxFilters } from '$lib/Constants';
import { filterEmojiTags, findIdentifier } from '$lib/EventHelper';
import { rxNostr, tie } from '$lib/timelines/MainTimeline';

// kind 10030
export const customEmojisEvent = writable<Event | undefined>();
// kind 10030 + 30030
export const customEmojiTags = writable<string[][]>([]);

export function storeCustomEmojis(event: Event): void {
	console.log('[custom emoji 10030]', event);

	// emoji tags
	customEmojiTags.set(filterEmojiTags(event.tags));
	const $customEmojiTags = get(customEmojiTags);

	// a tags
	const referenceTags = event.tags.filter(([tagName]) => tagName === 'a');
	if (referenceTags.length === 0) {
		return;
	}

	const customEmojiSetEventsMap = new Map<string, Event>();

	const emojisReq = createRxBackwardReq();
	rxNostr
		.use(emojisReq)
		.pipe(
			tie,
			uniq(),
			latestEach(
				({ event }) => `${event.kind}:${event.pubkey}:${findIdentifier(event.tags) ?? ''}`
			),
			filter(({ event }) => {
				const cache = customEmojiSetEventsMap.get(
					`${event.pubkey}:${findIdentifier(event.tags) ?? ''}`
				);
				return cache === undefined || cache.created_at < event.created_at;
			})
		)
		.subscribe({
			next: (packet) => {
				console.debug('[custom emoji next]', packet);

				const { event } = packet;

				customEmojiSetEventsMap.set(
					`${event.pubkey}:${findIdentifier(event.tags) ?? ''}`,
					event
				);

				$customEmojiTags.push(...filterEmojiTags(event.tags));
				customEmojiTags.set($customEmojiTags);
			},
			complete: () => {
				console.log('[custom emoji tags]', $customEmojiTags);
			},
			error: (error) => {
				console.error('[custom emoji error]', error);
			}
		});

	const filters: LazyFilter[] = referenceTags
		.map(([, reference]) => reference.split(':'))
		.filter(([kind]) => kind === `${30030}`)
		.map(([kind, pubkey, identifier]) => {
			return {
				kinds: [Number(kind)],
				authors: [pubkey],
				'#d': [identifier]
			};
		});
	console.debug('[custom emoji #a]', referenceTags, filters);
	for (const chunkedFilters of chunk(filters, maxFilters)) {
		emojisReq.emit(chunkedFilters);
	}
}
