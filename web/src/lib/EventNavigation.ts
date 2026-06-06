import type { Event } from 'nostr-typedef';
import { goto } from '$app/navigation';
import { nip19 } from 'nostr-tools';
import { get } from 'svelte/store';
import { channelIdStore } from '$lib/Channel';
import { findChannelId, filterTags } from '$lib/EventHelper';
import { getSeenOnRelays } from '$lib/timelines/MainTimeline';
import { emojiPickerOpen } from '$lib/components/EmojiPicker.svelte';
import { pubkey } from '$lib/stores/Author';
import { MouseButton } from '$lib/DomHelper';

const getTargetETag = (tags: string[][]): string => {
	const [, refEventId] = tags.findLast(
		([tagName, tagContent]) => (tagName === 'e' || tagName === 'q') && tagContent !== undefined
	) ?? ['', ''];
	return refEventId;
};

const shouldSkipNavigation = (clickEvent: MouseEvent | KeyboardEvent): boolean => {
	if (
		(clickEvent instanceof MouseEvent && clickEvent.button !== MouseButton.Left) ||
		emojiPickerOpen
	) {
		return true;
	}

	const target = clickEvent.target as HTMLElement | null;
	if (target === null) {
		return true;
	}
	if (target.closest('a, button, video, audio, dialog, .develop')) {
		return true;
	}
	return target.closest('p') !== null && String(document.getSelection()).length > 0;
};

const resolveChannelDestination = (nostrEvent: Event): string | undefined => {
	if (get(channelIdStore) !== undefined) {
		return undefined;
	}
	if (nostrEvent.kind === 40) {
		return `/channels/${nip19.neventEncode({
			id: nostrEvent.id,
			relays: getSeenOnRelays(nostrEvent.id),
			author: nostrEvent.pubkey,
			kind: nostrEvent.kind
		})}`;
	}
	if (nostrEvent.kind === 41 || nostrEvent.kind === 42) {
		const foundChannelId = findChannelId(nostrEvent.tags);
		if (foundChannelId !== undefined) {
			return `/channels/${nip19.neventEncode({ id: foundChannelId, relays: getSeenOnRelays(foundChannelId) })}`;
		}
	}
	return undefined;
};

const resolveZapDestination = (nostrEvent: Event): string | undefined => {
	if (nostrEvent.kind !== 9735 || getTargetETag(nostrEvent.tags) !== '') {
		return undefined;
	}
	const recipient = filterTags('p', nostrEvent.tags).at(0);
	const zapper = filterTags('P', nostrEvent.tags).at(0);
	const target = recipient === get(pubkey) && zapper !== undefined ? zapper : recipient;
	return target !== undefined ? `/${nip19.npubEncode(target)}` : undefined;
};

const resolveEventDestination = (nostrEvent: Event): string => {
	const eventId = [6, 7, 9735].includes(nostrEvent.kind)
		? getTargetETag(nostrEvent.tags)
		: nostrEvent.id;
	return `/${nip19.neventEncode({ id: eventId, relays: getSeenOnRelays(eventId) })}`;
};

const resolveDestination = (nostrEvent: Event): string =>
	resolveChannelDestination(nostrEvent) ??
	resolveZapDestination(nostrEvent) ??
	resolveEventDestination(nostrEvent);

export async function navigateTo(
	clickEvent: MouseEvent | KeyboardEvent,
	nostrEvent: Event,
	canTransition: boolean = true
): Promise<void> {
	if (shouldSkipNavigation(clickEvent)) {
		return;
	}
	if (!canTransition) {
		return;
	}
	await goto(resolveDestination(nostrEvent));
}
