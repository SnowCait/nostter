import { get } from 'svelte/store';
import type * as Nostr from 'nostr-typedef';
import { legacyBookmarkEvent } from '$lib/author/Bookmark.svelte';
import { isLegacyBookmarkEvent } from '$lib/features/bookmarks/domain/bookmark-migration';
import { isDeletedByAddress } from '$lib/features/event-deletion/application/deletion-state';

export function isDeletedLegacyBookmark(event: Nostr.Event): boolean {
	return isLegacyBookmarkEvent(event) && isDeletedByAddress(event);
}

export function applyLegacyBookmarkEvent(event: Nostr.Event): void {
	// A deletion request may arrive while the event is still waiting to be cached.
	if (isDeletedByAddress(event)) {
		return;
	}
	legacyBookmarkEvent.set(event);
}

export function clearDeletedLegacyBookmark(): void {
	const event = get(legacyBookmarkEvent);
	if (event !== undefined && isDeletedByAddress(event)) {
		legacyBookmarkEvent.set(undefined);
	}
}
