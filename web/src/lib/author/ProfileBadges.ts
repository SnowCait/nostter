import { get, writable } from 'svelte/store';
import { now } from 'rx-nostr';
import { filter, firstValueFrom } from 'rxjs';
import type * as Nostr from 'nostr-typedef';
import { metadataStore, seenOnStore } from '$lib/cache/Events';
import { metadataReqEmit, rxNostr } from '$lib/timelines/MainTimeline';
import { Queue } from '$lib/Queue';
import { fetchLastEvent } from '$lib/RxNostrHelper';
import { WebStorage } from '$lib/WebStorage';
import {
	addAcceptedBadgeTags,
	legacyProfileBadgesIdentifier,
	legacyProfileBadgesKind,
	profileBadgesKind,
	isProfileBadgesEvent,
	selectProfileBadgesEvent
} from '$lib/ProfileBadgesEvent';
import type { Signer } from '$lib/nostr/signing/signer';
import { auth } from '$lib/auth.svelte';

type DataType = 'accept';
type Data = {
	type: DataType;
	a: string;
	e: string;
};

const queue = new Queue<Data>();

let processing = false;

export { isProfileBadgesEvent };
export const legacyProfileBadgesKey = `${legacyProfileBadgesKind}:${legacyProfileBadgesIdentifier}`;
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

function getCachedProfileBadgesEvent(storage: WebStorage): Nostr.Event | undefined {
	return selectProfileBadgesEvent(
		storage.getReplaceableEvent(profileBadgesKind),
		storage.getParameterizedReplaceableEvent(
			legacyProfileBadgesKind,
			legacyProfileBadgesIdentifier
		)
	);
}

export async function acceptBadge(
	signEvent: Signer['signEvent'],
	a: string,
	e: string
): Promise<void> {
	console.log('[badge accept]', a, e, queue.dump());
	await save(signEvent, 'accept', a, e);
}

async function save(
	signEvent: Signer['signEvent'],
	type: DataType,
	a: string,
	e: string
): Promise<void> {
	const accountPubkey = auth.pubkey;
	if (accountPubkey === undefined) {
		throw new Error('Not authenticated');
	}

	queue.enqueue({ type, a, e });

	if (!processing) {
		processing = true;
		await publish(signEvent, accountPubkey);
		processing = false;
	}
}

async function publish(signEvent: Signer['signEvent'], accountPubkey: string): Promise<void> {
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

	const event = await signEvent({
		kind: profileBadgesKind,
		content: lastEvent?.content ?? '',
		tags,
		created_at: now()
	});
	console.log('[badge accepted]', event);

	profileBadgesEvent.set(event);

	// Lazy validation for UX
	if (!(await validate(lastEvent, accountPubkey))) {
		profileBadgesEvent.set(lastEvent);
		console.error('[badge cache outdated]');
		return;
	}

	storage.setReplaceableEvent(event, accountPubkey);
	await firstValueFrom(rxNostr.send(event).pipe(filter(({ ok }) => ok)));

	if (queue.length > 0) {
		await publish(signEvent, accountPubkey);
	}
}

async function validate(event: Nostr.Event | undefined, accountPubkey: string): Promise<boolean> {
	const [currentEvent, legacyEvent] = await Promise.all([
		fetchLastEvent({ kinds: [profileBadgesKind], authors: [accountPubkey], limit: 1 }),
		fetchLastEvent({
			kinds: [legacyProfileBadgesKind],
			authors: [accountPubkey],
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

	const followees = auth.followees;
	const $metadataStore = get(metadataStore);
	const pubkeys = followees.filter((pubkey) => !$metadataStore.has(pubkey));
	if (pubkeys.length > 0) {
		metadataReqEmit(pubkeys);
	}
	metadataFetched = true;
}

//#endregion
