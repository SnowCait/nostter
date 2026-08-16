import { get, writable } from 'svelte/store';
import { now } from 'rx-nostr';
import { filter, firstValueFrom } from 'rxjs';
import type * as Nostr from 'nostr-typedef';
import { metadataStore, seenOnStore } from '$lib/cache/Events';
import { metadataReqEmit, rxNostr } from '$lib/timelines/MainTimeline';
import { Queue } from '$lib/Queue';
import { fetchLastEvent } from '$lib/RxNostrHelper';
import { Signer } from '$lib/Signer';
import { WebStorage } from '$lib/WebStorage';
import {
	addAcceptedBadgeTags,
	legacyProfileBadgesIdentifier,
	legacyProfileBadgesKind,
	legacyProfileBadgesKey,
	profileBadgesKind,
	isProfileBadgesEvent,
	selectProfileBadgesEvent
} from '$lib/ProfileBadgesEvent';
import { followees, pubkey } from '../stores/Author';

type DataType = 'accept';
type Data = {
	type: DataType;
	a: string;
	e: string;
};

const queue = new Queue<Data>();

let processing = false;

export { isProfileBadgesEvent, legacyProfileBadgesKey };
export const profileBadgesEvent = writable<Nostr.Event | undefined>();

export function setProfileBadgesEvent(
	current: Nostr.Event | undefined,
	legacy: Nostr.Event | undefined
): void {
	profileBadgesEvent.set(
		selectProfileBadgesEvent(
			current !== undefined && isProfileBadgesEvent(current) ? current : undefined,
			legacy !== undefined && isProfileBadgesEvent(legacy) ? legacy : undefined
		)
	);
}

export function updateProfileBadgesEvent(event: Nostr.Event): void {
	if (!isProfileBadgesEvent(event)) {
		return;
	}
	profileBadgesEvent.update((current) => selectProfileBadgesEvent(current, event));
}

export function getCachedProfileBadgesEvent(storage: WebStorage): Nostr.Event | undefined {
	return selectProfileBadgesEvent(
		storage.getReplaceableEvent(profileBadgesKind),
		storage.getParameterizedReplaceableEvent(
			legacyProfileBadgesKind,
			legacyProfileBadgesIdentifier
		)
	);
}

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
	const lastEvent = getCachedProfileBadgesEvent(storage);
	let tags = lastEvent?.tags ?? [];
	let updated = false;

	while (queue.length > 0) {
		const data = queue.dequeue();
		if (data === undefined) {
			break;
		}

		if (data.type === 'accept') {
			const $seenOnStore = get(seenOnStore);
			const aRelays = $seenOnStore.get(data.a);
			const eRelays = $seenOnStore.get(data.e);
			const nextTags = addAcceptedBadgeTags(
				tags,
				data.a,
				data.e,
				aRelays?.values().next().value,
				eRelays?.values().next().value
			);
			if (nextTags !== undefined) {
				tags = nextTags;
				updated = true;
			}
		}
	}

	if (!updated) {
		console.warn('[badge not updated]');
		return;
	}

	const event = await Signer.signEvent({
		kind: profileBadgesKind,
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

	storage.setReplaceableEvent(event);
	await firstValueFrom(rxNostr.send(event).pipe(filter(({ ok }) => ok)));

	if (queue.length > 0) {
		await publish();
	}
}

async function validate(event: Nostr.Event | undefined): Promise<boolean> {
	const $pubkey = get(pubkey);
	const [currentEvent, legacyEvent] = await Promise.all([
		fetchLastEvent({ kinds: [profileBadgesKind], authors: [$pubkey], limit: 1 }),
		fetchLastEvent({
			kinds: [legacyProfileBadgesKind],
			authors: [$pubkey],
			'#d': [legacyProfileBadgesIdentifier],
			limit: 1
		})
	]);
	const relayEvent = selectProfileBadgesEvent(currentEvent, legacyEvent);

	if (event === undefined) {
		return relayEvent === undefined;
	}
	if (relayEvent === undefined) {
		return false;
	}
	return selectProfileBadgesEvent(event, relayEvent)?.id === event.id;
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
