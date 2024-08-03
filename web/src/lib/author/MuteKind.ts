import { get } from 'svelte/store';
import { now } from 'rx-nostr';
import { filter, firstValueFrom } from 'rxjs';
import type { Event } from 'nostr-typedef';
import { pubkey, storeMutedPubkeysByKind } from '$lib/stores/Author';
import { rxNostr } from '$lib/timelines/MainTimeline';
import { Queue } from '$lib/Queue';
import { fetchLastEvent } from '$lib/RxNostrHelper';
import { Signer } from '$lib/Signer';
import { WebStorage } from '$lib/WebStorage';
import { decryptListContent, encryptListContent } from '$lib/List';

type DataType = 'mute' | 'unmute';
type Data = {
	type: DataType;
	kind: number;
	pubkey: string;
};

const kind = 30007;
const queues = new Map([
	[6, new Queue<Data>()],
	[7, new Queue<Data>()],
	[16, new Queue<Data>()],
	[9735, new Queue<Data>()]
]);

let processing = false;

export async function muteByKind(muteKind: number, pubkey: string): Promise<void> {
	console.debug('[mute kind]', muteKind, pubkey, queues.get(muteKind)?.dump());
	await save('mute', muteKind, pubkey);
}

export async function unmuteByKind(muteKind: number, pubkey: string): Promise<void> {
	console.debug('[unmute kind]', muteKind, pubkey, queues.get(muteKind)?.dump());
	await save('unmute', muteKind, pubkey);
}

async function save(type: DataType, muteKind: number, pubkey: string): Promise<void> {
	const queue = queues.get(muteKind);
	if (queue === undefined) {
		console.warn('[mute kind unsupported]', muteKind);
		return;
	}

	queue.enqueue({
		type,
		kind: muteKind,
		pubkey: pubkey
	});

	if (!processing) {
		processing = true;
		await publish(muteKind);
		processing = false;
	}
}

async function publish(muteKind: number): Promise<void> {
	const queue = queues.get(muteKind);
	if (queue === undefined) {
		console.warn('[mute kind logic error]');
		return;
	}

	const storage = new WebStorage(localStorage);
	const lastEvent = storage.getParameterizedReplaceableEvent(kind, `${muteKind}`);
	let tags = lastEvent?.tags.concat() ?? [['d', `${muteKind}`]];
	let privateTags: string[][] = [];
	if (lastEvent !== undefined) {
		privateTags = await decryptListContent(lastEvent.content);
	}

	while (queue.length > 0) {
		const data = queue.dequeue();
		if (data === undefined) {
			break;
		}

		if (
			data.type === 'mute' &&
			![...tags, ...privateTags].some(
				([tagName, tagContent]) => tagName === 'p' && tagContent === data.pubkey
			)
		) {
			privateTags.push(['p', data.pubkey]);
		} else if (data.type === 'unmute') {
			if (
				tags.some(([tagName, tagContent]) => tagName === 'p' && tagContent === data.pubkey)
			) {
				tags = tags.filter(
					([tagName, tagContent]) => !(tagName === 'p' && tagContent === data.pubkey)
				);
			}
			if (
				privateTags.some(
					([tagName, tagContent]) => tagName === 'p' && tagContent === data.pubkey
				)
			) {
				privateTags = privateTags.filter(
					([tagName, tagContent]) => !(tagName === 'p' && tagContent === data.pubkey)
				);
			}
		}
	}

	// Lazy validation for UX
	if (!(await validate(lastEvent, muteKind))) {
		throw new Error('Cache is outdated.');
	}

	const event = await Signer.signEvent({
		kind,
		content: await encryptListContent(privateTags),
		tags,
		created_at: now()
	});
	storage.setParameterizedReplaceableEvent(event);
	storeMutedPubkeysByKind([event]);
	await firstValueFrom(rxNostr.send(event).pipe(filter(({ ok }) => ok)));

	if (queue.length > 0) {
		await publish(muteKind);
	}
}

async function validate(event: Event | undefined, muteKind: number): Promise<boolean> {
	const $pubkey = get(pubkey);
	const lastEvent = await fetchLastEvent({
		kinds: [kind],
		authors: [$pubkey],
		'#d': [`${muteKind}`],
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
