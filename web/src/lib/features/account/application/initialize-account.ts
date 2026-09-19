import { Author } from '$lib/Author';
import { author } from '$lib/stores/Author';
import { auth } from '$lib/auth.svelte';
import { loadFolloweesMetadataCache, pruneFolloweeReplaceableEventsCache } from '$lib/cache/Events';

export async function initializeAccount(pubkey: string): Promise<void> {
	const $author = new Author(pubkey);

	await $author.fetchRelays();

	const contactsTags = await $author.fetchEvents();
	auth.updateFollowees(contactsTags, pubkey);

	await loadFolloweesMetadataCache(auth.followees);
	pruneFolloweeReplaceableEventsCache(auth.followees);

	author.set($author);
}
