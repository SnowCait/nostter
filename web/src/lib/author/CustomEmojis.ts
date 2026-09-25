import { assertSignedEventPubkey } from '$lib/features/account/application/assert-signed-event-pubkey';
import { cacheAccountEvent, accountAddressableEventCache } from '$lib/cache/Events';
import { get, writable } from 'svelte/store';
import { createRxBackwardReq, latestEach, now, uniq, type LazyFilter } from 'rx-nostr';
import { filter, firstValueFrom } from 'rxjs';
import type * as Nostr from 'nostr-typedef';
import { chunk } from '$lib/array';
import { maxFilters } from '$lib/Constants';
import type { AddressPointer } from 'nostr-tools/nip19';
import {
	findIdentifier,
	getEventAddress,
	parseEventAddress
} from '$lib/nostr/protocol/event-address';
import { filterEmojiTags } from '$lib/nostr/protocol/nip30';
import { rxNostr, tie } from '$lib/timelines/MainTimeline';
import { Queue } from '$lib/Queue';
import { Emojisets, UserEmojiList } from 'nostr-tools/kinds';
import { fetchLastEvent } from '$lib/RxNostrHelper';
import type { Signer } from '$lib/nostr/signing/signer';
import { auth } from '$lib/auth.svelte';

// kind 10030
export const customEmojiListEvent = writable<Nostr.Event | undefined>();
// kind 10030 + 30030
export const customEmojiTags = writable<string[][]>([]);

const customEmojiSetEventsMap = new Map<string, Nostr.Event>();

export function applyCustomEmojiListSnapshot(event: Nostr.Event | undefined): void {
	customEmojiListEvent.set(event);
	if (event === undefined) {
		customEmojiTags.set([]);
		return;
	}
	storeCustomEmojis(event);
}

export function storeCustomEmojis(event: Nostr.Event): void {
	console.debug('[custom emoji]', event);

	// emoji tags
	customEmojiTags.set(filterEmojiTags(event.tags));
	const sourceEventId = event.id;

	// a tags
	const addressTags = event.tags.filter(([tagName]) => tagName === 'a');
	if (addressTags.length === 0) {
		return;
	}

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
				if (get(customEmojiListEvent)?.id !== sourceEventId) {
					return;
				}

				customEmojiSetEventsMap.set(
					`${event.pubkey}:${findIdentifier(event.tags) ?? ''}`,
					event
				);

				customEmojiTags.update((tags) => [...tags, ...filterEmojiTags(event.tags)]);
			},
			complete: () => {
				console.debug('[custom emoji tags]', get(customEmojiTags));
			},
			error: (error) => {
				console.error('[custom emoji error]', error);
			}
		});

	const filters: LazyFilter[] = addressTags
		.map(([, address]) => parseEventAddress(address))
		.filter((parsed): parsed is AddressPointer => parsed !== undefined)
		.filter(({ kind }) => kind === Emojisets)
		.map(({ kind, pubkey, identifier }) => {
			return {
				kinds: [Number(kind)],
				authors: [pubkey],
				'#d': [identifier]
			};
		});
	console.debug('[custom emoji #a]', addressTags, filters);
	for (const chunkedFilters of chunk(filters, maxFilters)) {
		emojisReq.emit(chunkedFilters);
	}
}

export function findCustomEmojiSetAddress(shortcode: string, url: string): string | undefined {
	for (const event of customEmojiSetEventsMap.values()) {
		const emojiTags = filterEmojiTags(event.tags);
		if (
			emojiTags.some(
				([, _shortcode, _url]) => `:${_shortcode}:` === shortcode && _url === url
			)
		) {
			return getEventAddress(event);
		}
	}
	return undefined;
}

//#region Publish

type DataType = 'add' | 'remove';
type Data = {
	type: DataType;
	address: string;
};

const queue = new Queue<Data>();

let processing = false;

export async function addToEmojiList(
	signEvent: Signer['signEvent'],
	address: string
): Promise<void> {
	await save(signEvent, 'add', address);
}

export async function removeFromEmojiList(
	signEvent: Signer['signEvent'],
	address: string
): Promise<void> {
	await save(signEvent, 'remove', address);
}

async function save(
	signEvent: Signer['signEvent'],
	type: DataType,
	address: string
): Promise<void> {
	const accountPubkey = auth.pubkey;
	if (accountPubkey === undefined) {
		throw new Error('Not authenticated');
	}

	queue.enqueue({ type, address });

	if (!processing) {
		processing = true;
		try {
			await publish(signEvent, accountPubkey);
		} finally {
			processing = false;
		}
	}
}

async function publish(signEvent: Signer['signEvent'], accountPubkey: string): Promise<void> {
	const lastEvent = await accountAddressableEventCache.get(accountPubkey, UserEmojiList);
	let tags = lastEvent?.tags ?? [];

	while (queue.length > 0) {
		const data = queue.dequeue()!;

		if (
			data.type === 'add' &&
			!tags.some(([tagName, address]) => tagName === 'a' && address === data.address)
		) {
			tags.push(['a', data.address]);
		} else if (
			data.type === 'remove' &&
			tags.some(([tagName, address]) => tagName === 'a' && address === data.address)
		) {
			tags = tags.filter(
				([tagName, address]) => !(tagName === 'a' && address === data.address)
			);
		}
	}

	if (!(await validate(lastEvent, accountPubkey))) {
		throw new Error('Cache is outdated.');
	}

	const event = await signEvent({
		kind: UserEmojiList,
		content: lastEvent?.content ?? '',
		tags,
		created_at: now()
	});
	assertSignedEventPubkey(event, accountPubkey);
	await cacheAccountEvent(event);
	await firstValueFrom(rxNostr.send(event).pipe(filter(({ ok }) => ok)));

	// Store
	customEmojiListEvent.set(event);
	storeCustomEmojis(event);

	if (queue.length > 0) {
		await publish(signEvent, accountPubkey);
	}
}

async function validate(event: Nostr.Event | undefined, accountPubkey: string): Promise<boolean> {
	const lastEvent = await fetchLastEvent({
		kinds: [UserEmojiList],
		authors: [accountPubkey],
		limit: 1
	});

	if (event === undefined) {
		if (lastEvent !== undefined) {
			return false;
		}
	} else if (lastEvent === undefined || event.created_at < lastEvent.created_at) {
		return false;
	}

	return true;
}

//#endregion
