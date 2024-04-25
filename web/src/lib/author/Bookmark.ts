import { get, writable, type Writable } from 'svelte/store';
import { now } from 'rx-nostr';
import { filter, firstValueFrom } from 'rxjs';
import type { Event } from 'nostr-typedef';
import { rxNostr } from '$lib/timelines/MainTimeline';
import { Queue } from '$lib/Queue';
import { fetchLastEvent } from '$lib/RxNostrHelper';
import { Signer } from '$lib/Signer';
import { WebStorage } from '$lib/WebStorage';
import { pubkey } from '../../stores/Author';

type DataType = 'bookmark' | 'unbookmark';
type Data = {
	type: DataType;
	tag: string[];
};

const kind = 30001;
const identifier = 'bookmark';
const queue = new Queue<Data>();

let processing = false;

export const bookmarkEvent: Writable<Event | undefined> = writable();

// TODO: Private bookmarks
export const isBookmarked = (event: Event): boolean => {
	const $bookmarkEvent = get(bookmarkEvent);
	if ($bookmarkEvent === undefined) {
		return false;
	}
	return $bookmarkEvent.tags.some(([tagName, id]) => tagName === 'e' && id === event.id);
};

export async function bookmark(tag: string[]): Promise<void> {
	console.log('[bookmark]', tag, queue.dump());
	await save('bookmark', tag);
}

export async function unbookmark(tag: string[]): Promise<void> {
	console.log('[unbookmark]', tag, queue.dump());
	await save('unbookmark', tag);
}

async function save(type: DataType, tag: string[]): Promise<void> {
	queue.enqueue({
		type,
		tag
	});

	if (!processing) {
		processing = true;
		await publish();
		processing = false;
	}
}

async function publish(): Promise<void> {
	const storage = new WebStorage(localStorage);
	const lastEvent = storage.getParameterizedReplaceableEvent(kind, identifier);
	let tags = lastEvent?.tags ?? [['d', identifier]];

	while (queue.length > 0) {
		const data = queue.dequeue();
		if (data === undefined) {
			break;
		}

		if (
			data.type === 'bookmark' &&
			!tags.some(([tagName, pubkey]) => tagName === data.tag[0] && pubkey === data.tag[1])
		) {
			tags.push(data.tag);
		} else if (
			data.type === 'unbookmark' &&
			tags.some(([tagName, pubkey]) => tagName === data.tag[0] && pubkey === data.tag[1])
		) {
			tags = tags.filter(
				([tagName, pubkey]) => !(tagName === data.tag[0] && pubkey === data.tag[1])
			);
		}
	}

	const event = await Signer.signEvent({
		kind,
		content: lastEvent?.content ?? '',
		tags,
		created_at: now()
	});

	bookmarkEvent.set(event);

	// Lazy validation for UX
	if (!(await validate(lastEvent))) {
		bookmarkEvent.set(lastEvent);
		throw new Error('Cache is outdated.');
	}

	storage.setParameterizedReplaceableEvent(event);
	await firstValueFrom(rxNostr.send(event).pipe(filter(({ ok }) => ok)));

	if (queue.length > 0) {
		await publish();
	}
}

async function validate(event: Event | undefined): Promise<boolean> {
	const $pubkey = get(pubkey);
	const lastEvent = await fetchLastEvent({
		kinds: [kind],
		authors: [$pubkey],
		'#d': [identifier],
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
