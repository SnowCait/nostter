import { get, writable } from 'svelte/store';
import { createRxBackwardReq, latestEach, now, uniq, type LazyFilter } from 'rx-nostr';
import { filter, firstValueFrom } from 'rxjs';
import type { Event } from 'nostr-typedef';
import { chunk } from '$lib/Array';
import { maxFilters } from '$lib/Constants';
import { filterEmojiTags, findIdentifier } from '$lib/EventHelper';
import { rxNostr, tie } from '$lib/timelines/MainTimeline';
import { Queue } from '$lib/Queue';
import { WebStorage } from '$lib/WebStorage';
import { UserEmojiList } from 'nostr-tools/kinds';
import { Signer } from '$lib/Signer';
import { pubkey } from '$lib/stores/Author';
import { fetchLastEvent } from '$lib/RxNostrHelper';

// kind 10030
export const customEmojiListEvent = writable<Event | undefined>();
// kind 10030 + 30030
export const customEmojiTags = writable<string[][]>([]);

export function storeCustomEmojis(event: Event): void {
	console.debug('[custom emoji]', event);

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
				console.debug('[custom emoji tags]', $customEmojiTags);
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

//#region Publish

type DataType = 'add' | 'remove';
type Data = {
	type: DataType;
	address: string;
};

const queue = new Queue<Data>();

let processing = false;

export async function addToEmojiList(address: string): Promise<void> {
	await save('add', address);
}

export async function removeFromEmojiList(address: string): Promise<void> {
	await save('remove', address);
}

async function save(type: DataType, address: string): Promise<void> {
	queue.enqueue({ type, address });

	if (!processing) {
		processing = true;
		await publish();
		processing = false;
	}
}

async function publish(): Promise<void> {
	const storage = new WebStorage(localStorage);
	const lastEvent = storage.getReplaceableEvent(UserEmojiList);
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

	if (!(await validate(lastEvent))) {
		throw new Error('Cache is outdated.');
	}

	const event = await Signer.signEvent({
		kind: UserEmojiList,
		content: lastEvent?.content ?? '',
		tags,
		created_at: now()
	});
	storage.setReplaceableEvent(event);
	await firstValueFrom(rxNostr.send(event).pipe(filter(({ ok }) => ok)));

	// Store
	customEmojiListEvent.set(event);
	storeCustomEmojis(event);

	if (queue.length > 0) {
		await publish();
	}
}

async function validate(event: Event | undefined): Promise<boolean> {
	const $pubkey = get(pubkey);
	const lastEvent = await fetchLastEvent({
		kinds: [UserEmojiList],
		authors: [$pubkey],
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
