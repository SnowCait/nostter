import { get, writable } from 'svelte/store';
import { createRxBackwardReq, filterAsync, latestEach, now, uniq } from 'rx-nostr';
import type { Event } from 'nostr-typedef';
import { isDecodable } from '$lib/Encryption';
import { aTagContent, findIdentifier } from '$lib/EventHelper';
import { pubkey as authorPubkey } from '$lib/stores/Author';
import { rxNostr } from '$lib/timelines/MainTimeline';
import { Signer } from '$lib/Signer';
import { fetchLastEvent } from '$lib/RxNostrHelper';
import { WebStorage } from '$lib/WebStorage';

const kind = 30000;

export const peopleLists = writable(new Map<string, Event>());
export const processing = writable(false);

export function storePeopleList(event: Event): void {
	const $peopleLists = get(peopleLists);
	const key = aTagContent(event);
	const cache = $peopleLists.get(key);
	if (cache === undefined || cache.created_at < event.created_at) {
		$peopleLists.set(key, event);
		peopleLists.set($peopleLists);
	}
}

export function fetchPeopleLists(): void {
	const $authorPubkey = get(authorPubkey);
	const req = createRxBackwardReq();
	rxNostr
		.use(req)
		.pipe(
			uniq(),
			latestEach(({ event }) => aTagContent(event)),
			filterAsync(({ event }) => isPeopleList(event))
		)
		.subscribe(({ event }) => {
			console.debug('[people list]', event);
			storePeopleList(event);
		});
	req.emit([
		{
			kinds: [kind],
			authors: [$authorPubkey]
		}
	]);
	req.over();
}

// For legacy clients
export async function isPeopleList(event: Event): Promise<boolean> {
	if (event.kind !== kind) {
		return false;
	}

	if (findIdentifier(event.tags) === 'mute') {
		return false;
	}

	return (
		event.tags.some(([tagName, pubkey]) => tagName === 'p' && pubkey !== undefined) ||
		(await isDecodable(event.pubkey, event.content))
	);
}

export async function contains(pubkey: string, event: Event): Promise<boolean> {
	if (event.tags.some(([tagName, p]) => tagName === 'p' && p === pubkey)) {
		return true;
	}

	if (event.content === '') {
		return false;
	}

	const $authorPubkey = get(authorPubkey);

	try {
		const content = await Signer.decrypt($authorPubkey, event.content);
		const privateTags = JSON.parse(content) as string[][];
		return privateTags.some(([tagName, p]) => tagName === 'p' && p === pubkey);
	} catch (error) {
		console.warn('[people list decode error]', error);
		return false;
	}
}

export async function createPeopleList(title: string, pubkey: string): Promise<void> {
	const $authorPubkey = get(authorPubkey);
	const event = await Signer.signEvent({
		kind: kind,
		pubkey: $authorPubkey,
		content: '',
		tags: [
			['d', title],
			['title', title],
			['p', pubkey]
		],
		created_at: now()
	});
	storePeopleList(event);
	rxNostr.send(event).subscribe(({ from, ok }) => {
		console.debug('[people list send]', from, ok);
	});
}

export async function addToPeopleList(event: Event, pubkey: string): Promise<void> {
	if (!(await validate(event))) {
		return;
	}

	const newEvent = await Signer.signEvent({
		kind: event.kind,
		pubkey: event.pubkey,
		content: event.content,
		tags: [...event.tags, ['p', pubkey]],
		created_at: now()
	});
	storePeopleList(newEvent);
	rxNostr.send(newEvent).subscribe(({ from, ok }) => {
		console.debug('[people list send]', from, ok);
	});
}

export async function removeFromPeopleList(event: Event, pubkey: string): Promise<void> {
	if (!(await validate(event))) {
		return;
	}

	let content = event.content;
	if (content !== '') {
		const decryptedContent = await Signer.decrypt(event.pubkey, event.content);
		const privateTags = JSON.parse(decryptedContent) as string[][];
		if (privateTags.some(([tagName, p]) => tagName === 'p' && p === pubkey)) {
			const json = JSON.stringify(
				privateTags.filter(([tagName, p]) => !(tagName === 'p' && p === pubkey))
			);
			content = await Signer.encrypt(event.pubkey, json);
		}
	}

	const newEvent = await Signer.signEvent({
		kind: event.kind,
		pubkey: event.pubkey,
		content,
		tags: event.tags.filter(([tagName, p]) => !(tagName === 'p' && p === pubkey)),
		created_at: now()
	});
	storePeopleList(newEvent);
	rxNostr.send(newEvent).subscribe(({ from, ok }) => {
		console.debug('[people list send]', from, ok);
	});
}

async function validate(event: Event): Promise<boolean> {
	const $authorPubkey = get(authorPubkey);
	const identifier = findIdentifier(event.tags);
	if (event.kind !== kind || event.pubkey !== $authorPubkey || identifier === undefined) {
		return false;
	}

	const storage = new WebStorage(localStorage);
	const cache = storage.getParameterizedReplaceableEvent(event.kind, identifier);
	if (cache !== undefined && event.created_at < cache.created_at) {
		console.error('[people list outdated cache]', event, cache);
		return false;
	}

	const lastEvent = await fetchLastEvent({
		kinds: [event.kind],
		authors: [event.pubkey],
		'#d': [identifier],
		limit: 1
	});

	if (lastEvent === undefined || event.created_at < lastEvent.created_at) {
		console.error('[people list outdated last]', event, lastEvent);
		return false;
	}

	return true;
}
