import { get } from 'svelte/store';
import { createRxBackwardReq, latest, type EventPacket, now } from 'rx-nostr';
import type { Event, UnsignedEvent } from 'nostr-typedef';
import { rxNostr } from './timelines/MainTimeline';
import { WebStorage } from './WebStorage';
import { Signer } from './Signer';
import { pubkey } from '../stores/Author';

const interestKind = 10015;
const queue: string[] = [];

let processing = false;

export function followHashtag(hashtag: string): void {
	console.log('[follow hashtag]', hashtag);

	queue.push(hashtag);

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
	const length = event.tags.filter(([tagName]) => tagName === 't').length;
	while (queue.length > 0) {
		const hashtag = queue.shift();
		if (hashtag === undefined) {
			continue;
		}
		if (event.tags.some(([tagName, tagContent]) => tagName === 't' && tagContent === hashtag)) {
			continue;
		}
		event.tags.push(['t', hashtag]);
	}
	if (event.tags.filter(([tagName]) => tagName === 't').length > length) {
		rxNostr.send(await Signer.signEvent(event)).subscribe((packet) => {
			console.log('[rx-nostr interest send]', packet);
		});
	}

	if (queue.length > 0) {
		save();
	} else {
		processing = false;
	}
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

function getCache(): Event | undefined {
	const storage = new WebStorage(localStorage);
	return storage.getReplaceableEvent(interestKind);
}
