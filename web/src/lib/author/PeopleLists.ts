import { accountAddressableEventCache } from '$lib/cache/Events';
import { get, writable } from 'svelte/store';
import { createRxBackwardReq, filterAsync, latestEach, now, uniq } from 'rx-nostr';
import type * as Nostr from 'nostr-typedef';
import { findIdentifier, getEventAddress } from '$lib/nostr/protocol/event-address';
import { rxNostr, tie } from '$lib/timelines/MainTimeline';
import { fetchLastEvent } from '$lib/RxNostrHelper';
import { createListContentDecrypter, createListContentEncrypter } from '$lib/List';
import type { EncryptionCapabilities, Signer } from '$lib/nostr/signing/signer';
import { auth } from '$lib/auth.svelte';

const kind = 30000;

export type PeopleListCapabilities = Pick<Signer, 'signEvent' | 'nip04' | 'nip44'>;
export type PeopleListClassifierCapabilities = Pick<Signer, 'nip04'>;

export const peopleLists = writable(new Map<string, Nostr.Event>());
export const processing = writable(false);

export function storePeopleList(event: Nostr.Event): void {
	const $peopleLists = get(peopleLists);
	const key = getEventAddress(event);
	const cache = $peopleLists.get(key);
	if (cache === undefined || cache.created_at < event.created_at) {
		$peopleLists.set(key, event);
		peopleLists.set($peopleLists);
	}
}

export function fetchPeopleLists(
	getClassifierCapabilities: () => PeopleListClassifierCapabilities
): void {
	const accountPubkey = auth.pubkey;
	if (accountPubkey === undefined) {
		throw new Error('Not authenticated');
	}

	const req = createRxBackwardReq();
	rxNostr
		.use(req)
		.pipe(
			tie,
			uniq(),
			latestEach(({ event }) => getEventAddress(event)),
			filterAsync(({ event }) => isPeopleList(event, getClassifierCapabilities))
		)
		.subscribe(({ event }) => {
			console.debug('[people list]', event);
			storePeopleList(event);
		});
	req.emit([
		{
			kinds: [kind],
			authors: [accountPubkey]
		}
	]);
	req.over();
}

// For legacy clients
export async function isPeopleList(
	event: Nostr.Event,
	getCapabilities: () => PeopleListClassifierCapabilities
): Promise<boolean> {
	if (event.kind !== kind) {
		return false;
	}

	if (findIdentifier(event.tags) === 'mute') {
		return false;
	}

	if (event.tags.some(([tagName, pubkey]) => tagName === 'p' && pubkey !== undefined)) {
		return true;
	}

	try {
		const { nip04 } = getCapabilities();
		if (nip04 === undefined) {
			return false;
		}
		await nip04.decrypt(event.pubkey, event.content);
		return true;
	} catch {
		return false;
	}
}

export async function contains(
	getEncryptionCapabilities: () => EncryptionCapabilities,
	pubkey: string,
	event: Nostr.Event
): Promise<boolean> {
	if (event.tags.some(([tagName, p]) => tagName === 'p' && p === pubkey)) {
		return true;
	}

	if (event.content === '') {
		return false;
	}

	const accountPubkey = auth.pubkey;
	if (accountPubkey === undefined) {
		throw new Error('Not authenticated');
	}

	try {
		const decrypter = createListContentDecrypter(getEncryptionCapabilities());
		if (decrypter === undefined) {
			return false;
		}
		const [privateTags] = await decrypter(accountPubkey, event.content);
		return privateTags.some(([tagName, p]) => tagName === 'p' && p === pubkey);
	} catch (error) {
		console.warn('[people list decode error]', error);
		return false;
	}
}

export async function createPeopleList(
	signEvent: Signer['signEvent'],
	title: string,
	pubkey: string
): Promise<void> {
	const accountPubkey = auth.pubkey;
	if (accountPubkey === undefined) {
		throw new Error('Not authenticated');
	}

	const event = await signEvent({
		kind: kind,
		pubkey: accountPubkey,
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

export async function addToPeopleList(
	signEvent: Signer['signEvent'],
	event: Nostr.Event,
	pubkey: string
): Promise<void> {
	const accountPubkey = auth.pubkey;
	if (accountPubkey === undefined) {
		throw new Error('Not authenticated');
	}

	if (!(await validate(event, accountPubkey))) {
		return;
	}

	const newEvent = await signEvent({
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

export async function removeFromPeopleList(
	capabilities: PeopleListCapabilities,
	event: Nostr.Event,
	pubkey: string
): Promise<void> {
	const accountPubkey = auth.pubkey;
	if (accountPubkey === undefined) {
		throw new Error('Not authenticated');
	}

	if (!(await validate(event, accountPubkey))) {
		return;
	}

	let content = event.content;
	if (content !== '') {
		const decrypter = createListContentDecrypter(capabilities);
		if (decrypter !== undefined) {
			const [privateTags, legacy] = await decrypter(event.pubkey, event.content);
			if (privateTags.some(([tagName, p]) => tagName === 'p' && p === pubkey)) {
				const tags = privateTags.filter(
					([tagName, p]) => !(tagName === 'p' && p === pubkey)
				);
				const encrypter = createListContentEncrypter(capabilities);
				content = await encrypter(accountPubkey, tags, legacy);
			}
		}
	}

	const newEvent = await capabilities.signEvent({
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

async function validate(event: Nostr.Event, accountPubkey: string): Promise<boolean> {
	const identifier = findIdentifier(event.tags);
	if (event.kind !== kind || event.pubkey !== accountPubkey || identifier === undefined) {
		return false;
	}

	const cache = await accountAddressableEventCache.get(event.pubkey, event.kind, identifier);
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
