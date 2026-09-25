import { now } from 'rx-nostr';
import { filter, firstValueFrom } from 'rxjs';
import type * as Nostr from 'nostr-typedef';
import { storeMutedTags } from '$lib/stores/Author';
import { rxNostr } from '$lib/timelines/MainTimeline';
import { Queue } from '$lib/Queue';
import { fetchLastEvent } from '$lib/RxNostrHelper';
import { WebStorage } from '$lib/WebStorage';
import { createListContentDecrypter, createListContentEncrypter } from '$lib/List';
import { isLegacyEncryption } from '$lib/nostr/protocol/nip04';
import type { Signer } from '$lib/nostr/signing/signer';
import { auth } from '$lib/auth.svelte';

type DataType = 'mute' | 'unmute';
type Data = {
	type: DataType;
	tagName: string;
	tagContent: string;
};

const kind = 10000;
const queue = new Queue<Data>();

let processing = false;

export type MuteCapabilities = Pick<Signer, 'signEvent' | 'nip04' | 'nip44'>;

export async function mute(
	capabilities: MuteCapabilities,
	tagName: string,
	tagContent: string
): Promise<void> {
	console.log('[mute]', tagName, tagContent, queue.dump());
	await save(capabilities, 'mute', tagName, tagContent);
}

export async function unmute(
	capabilities: MuteCapabilities,
	tagName: string,
	tagContent: string
): Promise<void> {
	console.log('[unmute]', tagName, tagContent, queue.dump());
	await save(capabilities, 'unmute', tagName, tagContent);
}

async function save(
	capabilities: MuteCapabilities,
	type: DataType,
	tagName: string,
	tagContent: string
): Promise<void> {
	const accountPubkey = auth.pubkey;
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
		await publish(capabilities, accountPubkey);
		processing = false;
	}
}

async function publish(capabilities: MuteCapabilities, accountPubkey: string): Promise<void> {
	const storage = new WebStorage(localStorage);
	const lastEvent = storage.getReplaceableEvent(kind, accountPubkey);
	let tags = lastEvent?.tags.concat() ?? [];
	let privateTags: string[][] = [];
	let legacy = lastEvent === undefined ? false : isLegacyEncryption(lastEvent.content);
	const decryptPrivateListContent = createListContentDecrypter(capabilities);
	if (lastEvent !== undefined && decryptPrivateListContent !== undefined) {
		const [_privateTags, _legacy] = await decryptPrivateListContent(
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
		let cachedPrivateTags: string[][] = [];
		if (lastEvent !== undefined && decryptPrivateListContent !== undefined) {
			const [tags] = await decryptPrivateListContent(lastEvent.pubkey, lastEvent.content);
			cachedPrivateTags = tags;
		}
		storeMutedTags([...(lastEvent?.tags ?? []), ...cachedPrivateTags], accountPubkey);
		throw new Error('Cache is outdated.');
	}

	const encryptPrivateListContent = createListContentEncrypter(capabilities);
	const event = await capabilities.signEvent({
		kind,
		content: await encryptPrivateListContent(accountPubkey, privateTags, legacy),
		tags,
		created_at: now()
	});
	storage.setReplaceableEvent(event, accountPubkey);
	await firstValueFrom(rxNostr.send(event).pipe(filter(({ ok }) => ok)));

	if (queue.length > 0) {
		await publish(capabilities, accountPubkey);
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
