import { writable } from 'svelte/store';
import { createRxBackwardReq, latest, type EventPacket, now } from 'rx-nostr';
import type * as Nostr from 'nostr-typedef';
import { rxNostr, tie } from './timelines/MainTimeline';
import { accountAddressableEventCache } from './cache/Events';
import type { Signer } from './nostr/signing/signer';
import { auth } from './auth.svelte';
import { assertSignedEventPubkey } from './nostr/signing/assert-signed-event-pubkey';
import { parseFollowingHashtags } from './nostr/protocol/interest-list';

const interestKind = 10015;
const followQueue: string[] = [];
const unfollowQueue: string[] = [];

let processing = false;

export const followingHashtags = writable<string[]>([]);

export function updateFollowingHashtags(event: Nostr.Event): void {
	if (event.pubkey !== auth.pubkey) return;
	followingHashtags.set(parseFollowingHashtags(event));
}

export async function followHashtag(
	signEvent: Signer['signEvent'],
	hashtag: string
): Promise<void> {
	console.log('[follow hashtag]', hashtag);

	const accountPubkey = auth.pubkey;
	if (accountPubkey === undefined) {
		throw new Error('Not authenticated');
	}

	if (followQueue.includes(hashtag)) {
		return;
	}

	followQueue.push(hashtag);

	if (processing) {
		return;
	}

	await save(signEvent, accountPubkey);
}

export async function unfollowHashtag(
	signEvent: Signer['signEvent'],
	hashtag: string
): Promise<void> {
	console.log('[unfollow hashtag]', hashtag);

	const accountPubkey = auth.pubkey;
	if (accountPubkey === undefined) {
		throw new Error('Not authenticated');
	}

	if (unfollowQueue.includes(hashtag)) {
		return;
	}

	unfollowQueue.push(hashtag);

	if (processing) {
		return;
	}

	await save(signEvent, accountPubkey);
}

async function save(signEvent: Signer['signEvent'], accountPubkey: string): Promise<void> {
	processing = true;
	try {
		const latest = await fetch(accountPubkey);
		const cache = await getCache(accountPubkey);

		// Validation
		if (cache !== undefined) {
			if (latest === undefined || latest.created_at < cache.created_at) {
				throw new Error('Cannot fetch latest event');
			}
		}

		// Send
		const event: Nostr.UnsignedEvent = {
			kind: interestKind,
			pubkey: accountPubkey,
			content: latest?.content ?? '',
			tags: latest?.tags ?? [],
			created_at: now()
		};

		while (followQueue.length > 0) {
			const hashtag = followQueue.shift();
			if (hashtag === undefined) {
				continue;
			}
			if (
				event.tags.some(
					([tagName, tagContent]) => tagName === 't' && tagContent === hashtag
				)
			) {
				continue;
			}
			event.tags.push(['t', hashtag]);
		}

		while (unfollowQueue.length > 0) {
			const hashtag = unfollowQueue.shift();
			if (hashtag === undefined) {
				continue;
			}
			if (
				!event.tags.some(
					([tagName, tagContent]) => tagName === 't' && tagContent === hashtag
				)
			) {
				continue;
			}
			event.tags = event.tags.filter(
				([tagName, tagContent]) => tagName !== 't' || tagContent !== hashtag
			);
		}

		const signedEvent = await signEvent(event);
		assertSignedEventPubkey(signedEvent, accountPubkey);
		let first = true;
		rxNostr.send(signedEvent).subscribe((packet) => {
			console.log('[rx-nostr interest send]', packet);
			if (packet.ok && first) {
				first = false;
				updateFollowingHashtags(signedEvent);
			}
		});
	} finally {
		processing = false;
	}
}

async function fetch(pubkey: string): Promise<Nostr.Event | undefined> {
	return await new Promise((resolve) => {
		let latestPacket: EventPacket | undefined;
		const req = createRxBackwardReq();
		rxNostr
			.use(req)
			.pipe(tie, latest())
			.subscribe({
				next: (packet) => {
					console.debug('[rx-nostr interest next]', packet);
					latestPacket = packet;
				},
				complete: () => {
					console.debug('[rx-nostr interest complete]', latestPacket);
					resolve(latestPacket?.event);
				}
			});
		req.emit([
			{
				kinds: [interestKind],
				authors: [pubkey],
				limit: 1
			}
		]);
		req.over();
	});
}

export function getCache(pubkey: string): Promise<Nostr.Event | undefined> {
	return accountAddressableEventCache.get(pubkey, interestKind);
}
