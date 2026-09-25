import { assertSignedEventPubkey } from '$lib/features/account/application/assert-signed-event-pubkey';
import { cacheAccountEvent, accountAddressableEventCache } from '$lib/cache/Events';
import { now } from 'rx-nostr';
import { filter, firstValueFrom } from 'rxjs';
import type * as Nostr from 'nostr-typedef';
import { storeMutedPubkeysByKind } from '$lib/stores/Author';
import { rxNostr } from '$lib/timelines/MainTimeline';
import { Queue } from '$lib/Queue';
import { fetchLastEvent } from '$lib/RxNostrHelper';
import { createListContentDecrypter, createListContentEncrypter } from '$lib/List';
import { isLegacyEncryption } from '$lib/nostr/protocol/nip04';
import type { Signer } from '$lib/nostr/signing/signer';
import { auth } from '$lib/auth.svelte';

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

export type MuteKindCapabilities = Pick<Signer, 'signEvent' | 'nip04' | 'nip44'>;

export async function muteByKind(
	capabilities: MuteKindCapabilities,
	muteKind: number,
	pubkey: string
): Promise<void> {
	console.debug('[mute kind]', muteKind, pubkey, queues.get(muteKind)?.dump());
	await save(capabilities, 'mute', muteKind, pubkey);
}

export async function unmuteByKind(
	capabilities: MuteKindCapabilities,
	muteKind: number,
	pubkey: string
): Promise<void> {
	console.debug('[unmute kind]', muteKind, pubkey, queues.get(muteKind)?.dump());
	await save(capabilities, 'unmute', muteKind, pubkey);
}

async function save(
	capabilities: MuteKindCapabilities,
	type: DataType,
	muteKind: number,
	targetPubkey: string
): Promise<void> {
	const queue = queues.get(muteKind);
	if (queue === undefined) {
		console.warn('[mute kind unsupported]', muteKind);
		return;
	}

	const accountPubkey = auth.pubkey;
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
		try {
			await publish(capabilities, muteKind, accountPubkey);
		} finally {
			processing = false;
		}
	}
}

async function publish(
	capabilities: MuteKindCapabilities,
	muteKind: number,
	accountPubkey: string
): Promise<void> {
	const queue = queues.get(muteKind);
	if (queue === undefined) {
		console.warn('[mute kind logic error]');
		return;
	}

	const lastEvent = await accountAddressableEventCache.get(accountPubkey, kind, `${muteKind}`);
	let tags = lastEvent?.tags.concat() ?? [['d', `${muteKind}`]];
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

	const encryptPrivateListContent = createListContentEncrypter(capabilities);
	const event = await capabilities.signEvent({
		kind,
		content: await encryptPrivateListContent(accountPubkey, privateTags, legacy),
		tags,
		created_at: now()
	});
	assertSignedEventPubkey(event, accountPubkey);
	await cacheAccountEvent(event);
	storeMutedPubkeysByKind([event], decryptPrivateListContent);
	await firstValueFrom(rxNostr.send(event).pipe(filter(({ ok }) => ok)));

	if (queue.length > 0) {
		await publish(capabilities, muteKind, accountPubkey);
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
