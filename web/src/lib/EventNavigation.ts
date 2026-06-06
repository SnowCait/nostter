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

const shouldSkipNavigation = (clickEvent: MouseEvent): boolean => {
	if (clickEvent.button !== MouseButton.Left) {
		return true;
	}

	let target: HTMLElement | null = clickEvent.target as HTMLElement;
	if (target.closest('.svelteui-Menu-root') || target.closest('a') || emojiPickerOpen) {
		return true;
	}
	while (target && !target.classList.contains('timeline')) {
		if (target.classList.contains('emoji-picker') || target.classList.contains('develop')) {
			return true;
		}
		const tagName = target.tagName.toLocaleLowerCase();
		if (
			tagName === 'button' ||
			tagName === 'video' ||
			tagName === 'audio' ||
			tagName === 'dialog'
		) {
			return true;
		}
		if (tagName === 'p' && String(document.getSelection()).length) {
			return true;
		}
		target = target.parentElement;
	}
	return false;
};

const resolveDestination = (nostrEvent: Event): string => {
	const channelId = get(channelIdStore);
	if (nostrEvent.kind === 40 && channelId === undefined) {
		return `/channels/${nip19.neventEncode({
			id: nostrEvent.id,
			relays: getSeenOnRelays(nostrEvent.id),
			author: nostrEvent.pubkey,
			kind: nostrEvent.kind
		})}`;
	}
	if ((nostrEvent.kind === 41 || nostrEvent.kind === 42) && channelId === undefined) {
		const foundChannelId = findChannelId(nostrEvent.tags);
		if (foundChannelId !== undefined) {
			return `/channels/${nip19.neventEncode({ id: foundChannelId, relays: getSeenOnRelays(foundChannelId) })}`;
		}
	}
	if (nostrEvent.kind === 9735 && getTargetETag(nostrEvent.tags) === '') {
		const recipient = filterTags('p', nostrEvent.tags).at(0);
		const zapper = filterTags('P', nostrEvent.tags).at(0);
		const target = recipient === get(pubkey) && zapper !== undefined ? zapper : recipient;
		if (target !== undefined) {
			return `/${nip19.npubEncode(target)}`;
		}
	}
	const eventId = [6, 7, 9735].includes(nostrEvent.kind)
		? getTargetETag(nostrEvent.tags)
		: nostrEvent.id;
	const nevent = nip19.neventEncode({ id: eventId, relays: getSeenOnRelays(eventId) });
	return `/${nevent}`;
};

export async function navigateTo(
	clickEvent: MouseEvent,
	nostrEvent: Event,
	canTransition: boolean
): Promise<void> {
	if (shouldSkipNavigation(clickEvent)) {
		return;
	}
	if (!canTransition) {
		return;
	}
	await goto(resolveDestination(nostrEvent));
}
