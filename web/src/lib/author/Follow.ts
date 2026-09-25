import { assertSignedEventPubkey } from '$lib/nostr/signing/assert-signed-event-pubkey';
import { cacheAccountEvent, accountAddressableEventCache } from '$lib/cache/Events';
import { get } from 'svelte/store';
import { now } from 'rx-nostr';
import { filter, firstValueFrom } from 'rxjs';
import type * as Nostr from 'nostr-typedef';
import { metadataStore } from '$lib/cache/Events';
import { metadataReqEmit, rxNostr } from '$lib/timelines/MainTimeline';
import { updateFolloweesStore } from '$lib/Contacts';
import { Queue } from '$lib/Queue';
import { fetchLastEvent } from '$lib/RxNostrHelper';
import type { Signer } from '$lib/nostr/signing/signer';
import { timeline as homeTimeline } from '$lib/timelines/HomeTimeline';
import { auth } from '$lib/auth.svelte';

type DataType = 'follow' | 'unfollow';
type Data = {
	type: DataType;
	pubkey: string;
};

const kind = 3;
const queue = new Queue<Data>();

let processing = false;

export async function follow(signEvent: Signer['signEvent'], pubkeys: string[]): Promise<void> {
	console.debug('[follow]', pubkeys, queue.dump());
	await save(signEvent, 'follow', pubkeys);
}

export async function unfollow(signEvent: Signer['signEvent'], pubkeys: string[]): Promise<void> {
	console.debug('[unfollow]', pubkeys, queue.dump());
	await save(signEvent, 'unfollow', pubkeys);
}

async function save(
	signEvent: Signer['signEvent'],
	type: DataType,
	pubkeys: string[]
): Promise<void> {
	const accountPubkey = auth.pubkey;
	if (accountPubkey === undefined) {
		throw new Error('Not authenticated');
	}

	for (const pubkey of pubkeys) {
		queue.enqueue({
			type,
			pubkey
		});
	}

	if (!processing) {
		processing = true;
		try {
			await publish(signEvent, accountPubkey);
		} finally {
			processing = false;
		}
	}
}

async function publish(signEvent: Signer['signEvent'], accountPubkey: string): Promise<void> {
	const lastEvent = await accountAddressableEventCache.get(accountPubkey, kind);
	let tags = lastEvent?.tags.concat() ?? [];

	while (queue.length > 0) {
		const data = queue.dequeue();
		if (data === undefined) {
			break;
		}

		if (
			data.type === 'follow' &&
			!tags.some(([tagName, pubkey]) => tagName === 'p' && pubkey === data.pubkey)
		) {
			tags.push(['p', data.pubkey]);
		} else if (
			data.type === 'unfollow' &&
			tags.some(([tagName, pubkey]) => tagName === 'p' && pubkey === data.pubkey)
		) {
			tags = tags.filter(([tagName, pubkey]) => !(tagName === 'p' && pubkey === data.pubkey));
		}
	}

	if (auth.pubkey === accountPubkey) {
		updateFolloweesStore(tags);
	}

	// Lazy validation for UX
	if (!(await validate(lastEvent, accountPubkey))) {
		if (auth.pubkey === accountPubkey) {
			updateFolloweesStore(lastEvent?.tags ?? []);
		}
		throw new Error('Cache is outdated.');
	}

	const event = await signEvent({
		kind,
		content: lastEvent?.content ?? '',
		tags,
		created_at: now()
	});
	try {
		assertSignedEventPubkey(event, accountPubkey);
	} catch (error) {
		if (auth.pubkey === accountPubkey) {
			updateFolloweesStore(lastEvent?.tags ?? []);
		}
		throw error;
	}
	await cacheAccountEvent(event);
	await firstValueFrom(rxNostr.send(event).pipe(filter(({ ok }) => ok)));

	if (queue.length > 0) {
		await publish(signEvent, accountPubkey);
	} else {
		homeTimeline.subscribe();
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

//#region Metadata

let metadataFetched = false;

export function fetchFolloweesMetadata(): void {
	if (metadataFetched) {
		return;
	}

	const followees = auth.followees;
	const $metadataStore = get(metadataStore);
	const pubkeys = followees.filter((pubkey) => !$metadataStore.has(pubkey));
	if (pubkeys.length > 0) {
		metadataReqEmit(pubkeys);
	}
	metadataFetched = true;
}

//#endregion
