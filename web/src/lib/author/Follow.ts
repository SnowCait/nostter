import { get } from 'svelte/store';
import { now } from 'rx-nostr';
import { filter, firstValueFrom } from 'rxjs';
import type { Event } from 'nostr-typedef';
import { rxNostr } from '$lib/timelines/MainTimeline';
import { updateFolloweesStore } from '$lib/Contacts';
import { Queue } from '$lib/Queue';
import { fetchLastEvent } from '$lib/RxNostrHelper';
import { Signer } from '$lib/Signer';
import { WebStorage } from '$lib/WebStorage';
import { pubkey } from '../../stores/Author';

type DataType = 'follow' | 'unfollow';
type Data = {
	type: DataType;
	pubkey: string;
};

const kind = 3;
const queue = new Queue<Data>();

let processing = false;

export async function follow(pubkey: string): Promise<void> {
	console.log('[follow]', pubkey, queue.dump());
	await save('follow', pubkey);
}

export async function unfollow(pubkey: string): Promise<void> {
	console.log('[unfollow]', pubkey, queue.dump());
	await save('unfollow', pubkey);
}

async function save(type: DataType, pubkey: string): Promise<void> {
	queue.enqueue({
		type,
		pubkey
	});

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
