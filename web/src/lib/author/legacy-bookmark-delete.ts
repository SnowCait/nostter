import { get } from 'svelte/store';
import { legacyBookmarkIdentifier } from '$lib/Constants';
import { WebStorage } from '$lib/WebStorage';
import { legacyBookmarkEvent } from './Bookmark.svelte';
import { isLegacyBookmarkEvent } from './BookmarkMigration';
import { requestEventDeletion } from './Delete';

export async function deleteLegacyBookmarks(): Promise<void> {
	const legacyEvent = get(legacyBookmarkEvent);
	if (legacyEvent === undefined) {
		throw new Error('Legacy bookmark event not found.');
	}
	if (!isLegacyBookmarkEvent(legacyEvent)) {
		throw new Error('Invalid legacy bookmark event.');
	}

	await requestEventDeletion([legacyEvent]);

	const storage = new WebStorage(localStorage);
	storage.removeParameterizedReplaceableEvent(legacyEvent.kind, legacyBookmarkIdentifier);
	legacyBookmarkEvent.set(undefined);
}
