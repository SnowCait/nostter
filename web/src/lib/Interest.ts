import { get, writable } from 'svelte/store';
import { createRxBackwardReq, latest, type EventPacket, now } from 'rx-nostr';
import type { Event, UnsignedEvent } from 'nostr-typedef';
import { browser } from '$app/environment';
import { rxNostr } from './timelines/MainTimeline';
import { WebStorage } from './WebStorage';
import { Signer } from './Signer';
import { pubkey } from './stores/Author';

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

export function followHashtag(hashtag: string): void {
	console.log('[follow hashtag]', hashtag);

	if (followQueue.includes(hashtag)) {
		return;
	}

	followQueue.push(hashtag);

	if (processing) {
		return;
	}

	save();
}

export function unfollowHashtag(hashtag: string): void {
	console.log('[unfollow hashtag]', hashtag);

	if (unfollowQueue.includes(hashtag)) {
		return;
	}

	unfollowQueue.push(hashtag);

	if (processing) {
		return;
	}

	save();
}

async function save(): Promise<void> {
	processing = true;

	const $pubkey = get(pubkey);
	const latest = await fetch($pubkey);
	const cache = getCache();

	// Validation
	if (cache !== undefined) {
		if (latest === undefined || latest.created_at < cache.created_at) {
			processing = false;
			throw new Error('Cannot fetch latest event');
		}
	}

	// Send
	const event: UnsignedEvent = {
		kind: interestKind,
		pubkey: $pubkey,
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
	rxNostr.send(await Signer.signEvent(event)).subscribe((packet) => {
		console.log('[rx-nostr interest send]', packet);
		if (packet.ok && first) {
			first = false;
			updateFollowingHashtags();
		}
	});

	processing = false;
}

async function fetch(pubkey: string): Promise<Event | undefined> {
	return await new Promise((resolve) => {
		let latestPacket: EventPacket | undefined;
		const req = createRxBackwardReq();
		rxNostr
			.use(req)
			.pipe(latest())
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

export function getCache(): Event | undefined {
	const storage = new WebStorage(localStorage);
	return storage.getReplaceableEvent(interestKind);
}
