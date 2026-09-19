import { Author } from '$lib/Author';
import { author } from '$lib/stores/Author';
import { auth } from '$lib/auth.svelte';
import { parseFollowList } from '$lib/nostr/protocol/nip02';
import { loadFolloweesMetadataCache, pruneFolloweeReplaceableEventsCache } from '$lib/cache/Events';

export async function initializeAccount(pubkey: string): Promise<void> {
	const $author = new Author(pubkey);

	await $author.fetchRelays();

	const contactsTags = await $author.fetchEvents();
	const followingPubkeys = parseFollowList(contactsTags).map(({ pubkey }) => pubkey);
	auth.updateFollowingPubkeys(followingPubkeys, pubkey);

	await loadFolloweesMetadataCache(auth.followees);
	pruneFolloweeReplaceableEventsCache(auth.followees);

	author.set($author);
}
