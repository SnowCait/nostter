import { accountAddressableEventCache } from '$lib/cache/Events';
import { get } from 'svelte/store';
import { legacyBookmarkIdentifier } from '$lib/Constants';
import { legacyBookmarkEvent } from '$lib/author/Bookmark.svelte';
import { isLegacyBookmarkEvent } from '$lib/features/bookmarks/domain/bookmark-migration';
import { requestEventDeletion } from '$lib/features/event-deletion/application/request-event-deletion';
import type { Signer } from '$lib/nostr/signing/signer';

export async function deleteLegacyBookmarks(signEvent: Signer['signEvent']): Promise<void> {
	const legacyEvent = get(legacyBookmarkEvent);
	if (legacyEvent === undefined) {
		throw new Error('Legacy bookmark event not found.');
	}
	if (!isLegacyBookmarkEvent(legacyEvent)) {
		throw new Error('Invalid legacy bookmark event.');
	}

	await requestEventDeletion(signEvent, [legacyEvent]);

	await accountAddressableEventCache.remove(
		legacyEvent.pubkey,
		legacyEvent.kind,
		legacyBookmarkIdentifier
	);
	legacyBookmarkEvent.set(undefined);
}
