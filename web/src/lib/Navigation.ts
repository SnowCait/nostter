import type { Event } from 'nostr-typedef';
import { MouseButton } from './DomHelper';
import { getSeenOnRelays } from './timelines/MainTimeline';
import * as nip19 from 'nostr-tools/nip19';
import { goto } from '$app/navigation';
import { emojiPickerOpen } from './components/EmojiPicker.svelte';

export async function navigateTo(e: MouseEvent | KeyboardEvent, nostrEvent: Event): Promise<void> {
	if (
		(e instanceof MouseEvent && e.button !== MouseButton.Left) ||
		e.target === null ||
		emojiPickerOpen
	) {
		return;
	}

	const target = e.target as HTMLElement;
	if (
		target.closest('a') ||
		target.closest('button') ||
		target.closest('video') ||
		target.closest('audio') ||
		target.closest('dialog') ||
		target.closest('.emoji-picker') ||
		target.closest('.develop')
	) {
		return;
	} else if (target.closest('p') && String(document.getSelection()).length > 0) {
		return;
	}

	const id = nostrEvent.id;
	const nevent = nip19.neventEncode({ id, relays: getSeenOnRelays(id) });
	await goto(`/${nevent}`);
}
