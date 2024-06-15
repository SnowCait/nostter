import { get, writable } from 'svelte/store';
import { now } from 'rx-nostr';
import { filter, firstValueFrom } from 'rxjs';
import type { Event } from 'nostr-typedef';
import { metadataStore, seenOnStore } from '$lib/cache/Events';
import { metadataReqEmit, rxNostr } from '$lib/timelines/MainTimeline';
import { Queue } from '$lib/Queue';
import { fetchLastEvent } from '$lib/RxNostrHelper';
import { Signer } from '$lib/Signer';
import { WebStorage } from '$lib/WebStorage';
import { followees, pubkey } from '../stores/Author';

type DataType = 'accept';
type Data = {
	type: DataType;
	a: string;
	e: string;
};

const kind = 30008;
const identifier = 'profile_badges';
const queue = new Queue<Data>();

let processing = false;

export const profileBadgesKey = `${kind}:${identifier}`;
export const profileBadgesEvent = writable<Event | undefined>();

export async function acceptBadge(a: string, e: string): Promise<void> {
	console.log('[badge accept]', a, e, queue.dump());
	await save('accept', a, e);
}

async function save(type: DataType, a: string, e: string): Promise<void> {
	queue.enqueue({ type, a, e });

	if (!processing) {
		processing = true;
		await publish();
		processing = false;
	}
}

async function publish(): Promise<void> {
	const storage = new WebStorage(localStorage);
	const lastEvent = storage.getParameterizedReplaceableEvent(kind, identifier);
	const tags = lastEvent?.tags.concat() ?? [];

	while (queue.length > 0) {
		const data = queue.dequeue();
		if (data === undefined) {
			break;
		}

		if (
			data.type === 'accept' &&
			!tags.some(([tagName, a]) => tagName === 'a' && a === data.a)
		) {
			const $seenOnStore = get(seenOnStore);

			const aRelays = $seenOnStore.get(data.a);
			const aTag = ['a', data.a];
			if (aRelays !== undefined && aRelays.size > 0) {
				aTag.push([...aRelays.values()][0]);
			}

			const eRelays = $seenOnStore.get(data.e);
			const eTag = ['e', data.e];
			if (eRelays !== undefined && eRelays.size > 0) {
				eTag.push([...eRelays.values()][0]);
			}

			tags.push(aTag, eTag);
		}
	}

	if (lastEvent !== undefined && lastEvent.tags.length === tags.length) {
		console.warn('[badge not updated]');
		return;
	}

	const event = await Signer.signEvent({
		kind,
		content: lastEvent?.content ?? '',
		tags,
		created_at: now()
	});
	console.log('[badge accepted]', event);

	profileBadgesEvent.set(event);

	// Lazy validation for UX
	if (!(await validate(lastEvent))) {
		profileBadgesEvent.set(lastEvent);
		console.error('[badge cache outdated]');
		return;
	}

	storage.setParameterizedReplaceableEvent(event);
	await firstValueFrom(rxNostr.send(event).pipe(filter(({ ok }) => ok)));

	if (queue.length > 0) {
		await publish();
	}
}

async function validate(event: Event | undefined): Promise<boolean> {
	const $pubkey = get(pubkey);
	const lastEvent = await fetchLastEvent({
		kinds: [kind],
		authors: [$pubkey],
		'#d': [identifier],
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

//#region Metadata

let metadataFetched = false;

export function fetchFolloweesMetadata(): void {
	if (metadataFetched) {
		return;
	}

	const $followees = get(followees);
	const $metadataStore = get(metadataStore);
	const pubkeys = $followees.filter((pubkey) => !$metadataStore.has(pubkey));
	if (pubkeys.length > 0) {
		metadataReqEmit(pubkeys);
	}
	metadataFetched = true;
}

//#endregion
