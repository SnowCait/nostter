import type { Event } from 'nostr-typedef';
import { goto } from '$app/navigation';
import { nip19 } from 'nostr-tools';
import { get } from 'svelte/store';
import { channelIdStore } from '$lib/Channel';
import { findChannelId } from '$lib/EventHelper';
import { getSeenOnRelays } from '$lib/timelines/MainTimeline';
import { emojiPickerOpen } from '$lib/components/EmojiPicker.svelte';
import { MouseButton } from '$lib/DomHelper';

const getTargetETag = (tags: string[][]): string => {
	const [, refEventId] = tags.findLast(
		([tagName, tagContent]) => (tagName === 'e' || tagName === 'q') && tagContent !== undefined
	) ?? ['', ''];
	return refEventId;
};

export async function viewDetail(
	clickEvent: MouseEvent,
	nostrEvent: Event,
	canTransition: boolean
): Promise<void> {
	if (clickEvent.button !== MouseButton.Left) {
		return;
	}

	let target: HTMLElement | null = clickEvent.target as HTMLElement;
	if (target.closest('.svelteui-Menu-root') || target.closest('a') || emojiPickerOpen) {
		return;
	}
	if (target) {
		while (target && !target.classList.contains('timeline')) {
			if (target.classList.contains('emoji-picker') || target.classList.contains('develop')) {
				return;
			}
			const tagName = target.tagName.toLocaleLowerCase();
			if (
				tagName === 'button' ||
				tagName === 'video' ||
				tagName === 'audio' ||
				tagName === 'dialog'
			) {
				return;
			}
			if (tagName === 'p' && String(document.getSelection()).length) {
				return;
			}
			target = target.parentElement;
		}
	}
	if (canTransition) {
		const channelId = get(channelIdStore);
		if (nostrEvent.kind === 40 && channelId === undefined) {
			await goto(
				`/channels/${nip19.neventEncode({
					id: nostrEvent.id,
					relays: getSeenOnRelays(nostrEvent.id),
					author: nostrEvent.pubkey,
					kind: nostrEvent.kind
				})}`
			);
			return;
		}
		if ((nostrEvent.kind === 41 || nostrEvent.kind === 42) && channelId === undefined) {
			const foundChannelId = findChannelId(nostrEvent.tags);
			if (foundChannelId !== undefined) {
				await goto(
					`/channels/${nip19.neventEncode({ id: foundChannelId, relays: getSeenOnRelays(foundChannelId) })}`
				);
				return;
			}
		}
		const eventId = [6, 7, 9735].includes(nostrEvent.kind)
			? getTargetETag(nostrEvent.tags)
			: nostrEvent.id;
		const nevent = nip19.neventEncode({ id: eventId, relays: getSeenOnRelays(eventId) });
		await goto(`/${nevent}`);
	}
}
