import { get } from 'svelte/store';
import { now } from 'rx-nostr';
import { filter, firstValueFrom } from 'rxjs';
import type { Event } from 'nostr-typedef';
import { metadataStore } from '$lib/cache/Events';
import { metadataReqEmit, rxNostr } from '$lib/timelines/MainTimeline';
import { updateFolloweesStore } from '$lib/Contacts';
import { Queue } from '$lib/Queue';
import { fetchLastEvent } from '$lib/RxNostrHelper';
import { Signer } from '$lib/Signer';
import { WebStorage } from '$lib/WebStorage';
import { followees, pubkey } from '../stores/Author';
import { timeline as homeTimeline } from '$lib/timelines/HomeTimeline';

type DataType = 'follow' | 'unfollow';
type Data = {
	type: DataType;
	pubkey: string;
};

const kind = 3;
const queue = new Queue<Data>();

let processing = false;

export async function follow(pubkeys: string[]): Promise<void> {
	console.debug('[follow]', pubkeys, queue.dump());
	await save('follow', pubkeys);
}

export async function unfollow(pubkeys: string[]): Promise<void> {
	console.debug('[unfollow]', pubkeys, queue.dump());
	await save('unfollow', pubkeys);
}

async function save(type: DataType, pubkeys: string[]): Promise<void> {
	for (const pubkey of pubkeys) {
		queue.enqueue({
			type,
			pubkey
		});
	}

	if (!processing) {
		processing = true;
		await publish();
		processing = false;
	}
}

async function publish(): Promise<void> {
	const storage = new WebStorage(localStorage);
	const lastEvent = storage.getReplaceableEvent(kind);
	let tags = lastEvent?.tags ?? [];

	while (queue.length > 0) {
		const data = queue.dequeue();
		if (data === undefined) {
			break;
		}

		if (
			data.type === 'follow' &&
			!tags.some(([tagName, pubkey]) => tagName === 'p' && pubkey === data.pubkey)
		) {
			tags.push(['p', data.pubkey]);
		} else if (
			data.type === 'unfollow' &&
			tags.some(([tagName, pubkey]) => tagName === 'p' && pubkey === data.pubkey)
		) {
			tags = tags.filter(([tagName, pubkey]) => !(tagName === 'p' && pubkey === data.pubkey));
		}
	}

	updateFolloweesStore(tags);

	// Lazy validation for UX
	if (!(await validate(lastEvent))) {
		updateFolloweesStore(lastEvent?.tags ?? []);
		throw new Error('Cache is outdated.');
	}

	const event = await Signer.signEvent({
		kind,
		content: lastEvent?.content ?? '',
		tags,
		created_at: now()
	});
	storage.setReplaceableEvent(event);
	await firstValueFrom(rxNostr.send(event).pipe(filter(({ ok }) => ok)));

	if (queue.length > 0) {
		await publish();
	} else {
		homeTimeline.subscribe();
	}
}

async function validate(event: Event | undefined): Promise<boolean> {
	const $pubkey = get(pubkey);
	const lastEvent = await fetchLastEvent({ kinds: [kind], authors: [$pubkey], limit: 1 });

	if (event === undefined) {
		if (lastEvent !== undefined) {
			return false;
		}
	} else if (lastEvent === undefined || event.created_at < lastEvent.created_at) {
		return false;
	}

	return true;
}

//#region Metadata

let metadataFetched = false;

export function fetchFolloweesMetadata(): void {
	if (metadataFetched) {
		return;
	}

	const $followees = get(followees);
	const $metadataStore = get(metadataStore);
	const pubkeys = $followees.filter((pubkey) => !$metadataStore.has(pubkey));
	if (pubkeys.length > 0) {
		metadataReqEmit(pubkeys);
	}
	metadataFetched = true;
}

//#endregion
