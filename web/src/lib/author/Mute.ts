import { get } from 'svelte/store';
import { now } from 'rx-nostr';
import { filter, firstValueFrom } from 'rxjs';
import type * as Nostr from 'nostr-typedef';
import { pubkey, storeMutedTags } from '$lib/stores/Author';
import { rxNostr } from '$lib/timelines/MainTimeline';
import { Queue } from '$lib/Queue';
import { fetchLastEvent } from '$lib/RxNostrHelper';
import { Signer } from '$lib/Signer';
import { WebStorage } from '$lib/WebStorage';
import { decryptListContent, encryptListContent } from '$lib/List';

type DataType = 'mute' | 'unmute';
type Data = {
	type: DataType;
	tagName: string;
	tagContent: string;
};

const kind = 10000;
const queue = new Queue<Data>();

let processing = false;

export async function mute(tagName: string, tagContent: string): Promise<void> {
	console.log('[mute]', tagName, tagContent, queue.dump());
	await save('mute', tagName, tagContent);
}

export async function unmute(tagName: string, tagContent: string): Promise<void> {
	console.log('[unmute]', tagName, tagContent, queue.dump());
	await save('unmute', tagName, tagContent);
}

async function save(type: DataType, tagName: string, tagContent: string): Promise<void> {
	const accountPubkey = get(pubkey);
	if (accountPubkey === undefined) {
		throw new Error('Not authenticated');
	}

	queue.enqueue({
		type,
		tagName,
		tagContent
	});

	if (!processing) {
		processing = true;
		await publish(accountPubkey);
		processing = false;
	}
}

async function publish(accountPubkey: string): Promise<void> {
	const storage = new WebStorage(localStorage);
	const lastEvent = storage.getReplaceableEvent(kind);
	let tags = lastEvent?.tags.concat() ?? [];
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
				([tagName, tagContent]) =>
					tagName === data.tagName && tagContent === data.tagContent
			)
		) {
			privateTags.push([data.tagName, data.tagContent]);
		} else if (data.type === 'unmute') {
			if (
				tags.some(
					([tagName, tagContent]) =>
						tagName === data.tagName && tagContent === data.tagContent
				)
			) {
				tags = tags.filter(
					([tagName, tagContent]) =>
						!(tagName === data.tagName && tagContent === data.tagContent)
				);
			}
			if (
				privateTags.some(
					([tagName, tagContent]) =>
						tagName === data.tagName && tagContent === data.tagContent
				)
			) {
				privateTags = privateTags.filter(
					([tagName, tagContent]) =>
						!(tagName === data.tagName && tagContent === data.tagContent)
				);
			}
		}
	}

	storeMutedTags([...tags, ...privateTags], accountPubkey);

	// Lazy validation for UX
	if (!(await validate(lastEvent, accountPubkey))) {
		const [_privateTags] = await decryptListContent(
			lastEvent?.pubkey ?? accountPubkey,
			lastEvent?.content ?? ''
		);
		storeMutedTags([...(lastEvent?.tags ?? []), ..._privateTags], accountPubkey);
		throw new Error('Cache is outdated.');
	}

	const event = await Signer.signEvent({
		kind,
		content: await encryptListContent(accountPubkey, privateTags, legacy),
		tags,
		created_at: now()
	});
	storage.setReplaceableEvent(event, accountPubkey);
	await firstValueFrom(rxNostr.send(event).pipe(filter(({ ok }) => ok)));

	if (queue.length > 0) {
		await publish(accountPubkey);
	}
}

async function validate(event: Nostr.Event | undefined, accountPubkey: string): Promise<boolean> {
	const lastEvent = await fetchLastEvent({ kinds: [kind], authors: [accountPubkey], limit: 1 });

	if (event === undefined) {
		if (lastEvent !== undefined) {
			return false;
		}
	} else if (lastEvent === undefined || event.created_at < lastEvent.created_at) {
		return false;
	}

	return true;
}
