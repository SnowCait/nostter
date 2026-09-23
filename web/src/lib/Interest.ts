import { writable } from 'svelte/store';
import { createRxBackwardReq, latest, type EventPacket, now } from 'rx-nostr';
import type * as Nostr from 'nostr-typedef';
import { browser } from '$app/environment';
import { rxNostr, tie } from './timelines/MainTimeline';
import { WebStorage } from './WebStorage';
import type { Signer } from './nostr/signing/signer';
import { auth } from './auth.svelte';

const interestKind = 10015;
const followQueue: string[] = [];
const unfollowQueue: string[] = [];

let processing = false;

export const followingHashtags = writable(browser ? getFollowingHashtags() : []);

export function updateFollowingHashtags() {
	followingHashtags.set(getFollowingHashtags());
}

function getFollowingHashtags(): string[] {
	return (
		getCache()
			?.tags.filter(([tagName]) => tagName === 't')
			.map(([, hashtag]) => hashtag) ?? []
	);
}

export function followHashtag(signEvent: Signer['signEvent'], hashtag: string): void {
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

	save(signEvent, accountPubkey);
}

export function unfollowHashtag(signEvent: Signer['signEvent'], hashtag: string): void {
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

	save(signEvent, accountPubkey);
}

async function save(signEvent: Signer['signEvent'], accountPubkey: string): Promise<void> {
	processing = true;

	const latest = await fetch(accountPubkey);
	const cache = getCache();

	// Validation
	if (cache !== undefined) {
		if (latest === undefined || latest.created_at < cache.created_at) {
			processing = false;
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
		if (event.tags.some(([tagName, tagContent]) => tagName === 't' && tagContent === hashtag)) {
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
			!event.tags.some(([tagName, tagContent]) => tagName === 't' && tagContent === hashtag)
		) {
			continue;
		}
		event.tags = event.tags.filter(
			([tagName, tagContent]) => tagName !== 't' || tagContent !== hashtag
		);
	}

	let first = true;
	rxNostr.send(await signEvent(event)).subscribe((packet) => {
		console.log('[rx-nostr interest send]', packet);
		if (packet.ok && first) {
			first = false;
			updateFollowingHashtags();
		}
	});

	processing = false;
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

export function getCache(): Nostr.Event | undefined {
	const storage = new WebStorage(localStorage);
	return storage.getReplaceableEvent(interestKind);
}
