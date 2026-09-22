import { get } from 'svelte/store';
import { now } from 'rx-nostr';
import { filter, firstValueFrom } from 'rxjs';
import type * as Nostr from 'nostr-typedef';
import { pubkey, storeMutedPubkeysByKind } from '$lib/stores/Author';
import { rxNostr } from '$lib/timelines/MainTimeline';
import { Queue } from '$lib/Queue';
import { fetchLastEvent } from '$lib/RxNostrHelper';
import { WebStorage } from '$lib/WebStorage';
import { decryptListContent, encryptListContent } from '$lib/List';
import type { Signer } from '$lib/nostr/signing/signer';

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

export async function muteByKind(
	signEvent: Signer['signEvent'],
	muteKind: number,
	pubkey: string
): Promise<void> {
	console.debug('[mute kind]', muteKind, pubkey, queues.get(muteKind)?.dump());
	await save(signEvent, 'mute', muteKind, pubkey);
}

export async function unmuteByKind(
	signEvent: Signer['signEvent'],
	muteKind: number,
	pubkey: string
): Promise<void> {
	console.debug('[unmute kind]', muteKind, pubkey, queues.get(muteKind)?.dump());
	await save(signEvent, 'unmute', muteKind, pubkey);
}

async function save(
	signEvent: Signer['signEvent'],
	type: DataType,
	muteKind: number,
	targetPubkey: string
): Promise<void> {
	const queue = queues.get(muteKind);
	if (queue === undefined) {
		console.warn('[mute kind unsupported]', muteKind);
		return;
	}

	const accountPubkey = get(pubkey);
	if (accountPubkey === undefined) {
		throw new Error('Not authenticated');
	}

	queue.enqueue({
		type,
		kind: muteKind,
		pubkey: targetPubkey
	});

	if (!processing) {
		processing = true;
		await publish(signEvent, muteKind, accountPubkey);
		processing = false;
	}
}

async function publish(
	signEvent: Signer['signEvent'],
	muteKind: number,
	accountPubkey: string
): Promise<void> {
	const queue = queues.get(muteKind);
	if (queue === undefined) {
		console.warn('[mute kind logic error]');
		return;
	}

	const storage = new WebStorage(localStorage);
	const lastEvent = storage.getParameterizedReplaceableEvent(kind, `${muteKind}`);
	let tags = lastEvent?.tags.concat() ?? [['d', `${muteKind}`]];
	let privateTags: string[][] = [];
	let legacy = false;
	if (lastEvent !== undefined) {
		const [_privateTags, _legacy] = await decryptListContent(
			lastEvent.pubkey,
			lastEvent.content
		);
		privateTags = _privateTags;
		legacy = _legacy;
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
	if (!(await validate(lastEvent, muteKind, accountPubkey))) {
		throw new Error('Cache is outdated.');
	}

	const event = await signEvent({
		kind,
		content: await encryptListContent(accountPubkey, privateTags, legacy),
		tags,
		created_at: now()
	});
	storage.setParameterizedReplaceableEvent(event, accountPubkey);
	storeMutedPubkeysByKind([event], decryptListContent);
	await firstValueFrom(rxNostr.send(event).pipe(filter(({ ok }) => ok)));

	if (queue.length > 0) {
		await publish(signEvent, muteKind, accountPubkey);
	}
}

async function validate(
	event: Nostr.Event | undefined,
	muteKind: number,
	accountPubkey: string
): Promise<boolean> {
	const lastEvent = await fetchLastEvent({
		kinds: [kind],
		authors: [accountPubkey],
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
