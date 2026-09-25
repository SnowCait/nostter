import { now } from 'rx-nostr';
import { filter, firstValueFrom } from 'rxjs';
import type * as Nostr from 'nostr-typedef';
import { mute as muteState } from '$lib/features/mute/application/mute-state.svelte';
import { prepareKindMuteState } from '$lib/features/mute/domain/mute-state';
import { rxNostr } from '$lib/timelines/MainTimeline';
import { Queue } from '$lib/Queue';
import { fetchLastEvent } from '$lib/RxNostrHelper';
import { WebStorage } from '$lib/WebStorage';
import { createListContentDecrypter, createListContentEncrypter } from '$lib/List';
import { isLegacyEncryption } from '$lib/nostr/protocol/nip04';
import { shouldReplaceCurrentEvent } from '$lib/nostr/protocol/replaceable-event';
import type { Signer } from '$lib/nostr/signing/signer';
import { auth } from '$lib/auth.svelte';

type DataType = 'mute' | 'unmute';
type Data = {
	type: DataType;
	kind: number;
	pubkey: string;
};

const kind = 30007;
const supportedKinds = new Set([6, 7, 16, 9735]);
const queues = new Map<string, Queue<Data>>();
const processing = new Set<string>();

export type MuteKindCapabilities = Pick<Signer, 'signEvent' | 'nip04' | 'nip44'>;

export async function muteByKind(
	capabilities: MuteKindCapabilities,
	muteKind: number,
	pubkey: string
): Promise<void> {
	console.debug('[mute kind]', muteKind, pubkey);
	await save(capabilities, 'mute', muteKind, pubkey);
}

export async function unmuteByKind(
	capabilities: MuteKindCapabilities,
	muteKind: number,
	pubkey: string
): Promise<void> {
	console.debug('[unmute kind]', muteKind, pubkey);
	await save(capabilities, 'unmute', muteKind, pubkey);
}

async function save(
	capabilities: MuteKindCapabilities,
	type: DataType,
	muteKind: number,
	targetPubkey: string
): Promise<void> {
	if (!supportedKinds.has(muteKind)) {
		console.warn('[mute kind unsupported]', muteKind);
		return;
	}

	const accountPubkey = auth.pubkey;
	if (accountPubkey === undefined) {
		throw new Error('Not authenticated');
	}

	const queueKey = `${accountPubkey}:${muteKind}`;
	let queue = queues.get(queueKey);
	if (queue === undefined) {
		queue = new Queue<Data>();
		queues.set(queueKey, queue);
	}
	queue.enqueue({
		type,
		kind: muteKind,
		pubkey: targetPubkey
	});

	if (!processing.has(queueKey)) {
		processing.add(queueKey);
		try {
			await publish(capabilities, muteKind, accountPubkey, queue);
		} finally {
			processing.delete(queueKey);
			if (queue.length === 0) queues.delete(queueKey);
		}
	}
}

async function publish(
	capabilities: MuteKindCapabilities,
	muteKind: number,
	accountPubkey: string,
	queue: Queue<Data>
): Promise<void> {
	const storage = new WebStorage(localStorage);
	const cachedEvent = storage.getParameterizedReplaceableEvent(kind, `${muteKind}`);
	const lastEvent = cachedEvent?.pubkey === accountPubkey ? cachedEvent : undefined;
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
	storage.setParameterizedReplaceableEvent(event, accountPubkey);
	muteState.replaceKind(accountPubkey, muteKind, prepareKindMuteState(event, privateTags));
	await firstValueFrom(rxNostr.send(event).pipe(filter(({ ok }) => ok)));

	if (queue.length > 0) {
		await publish(capabilities, muteKind, accountPubkey, queue);
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
	} else if (lastEvent === undefined || shouldReplaceCurrentEvent(lastEvent, event)) {
		return false;
	}

	return true;
}
