import { Author } from '$lib/Author';
import { author } from '$lib/stores/Author';
import { unique } from '$lib/array';
import { parseFollowList } from '$lib/nostr/protocol/nip02';
import { loadFolloweesMetadataCache, pruneFolloweeReplaceableEventsCache } from '$lib/cache/Events';

export async function initializeAccount(pubkey: string): Promise<string[]> {
	const $author = new Author(pubkey);

	await $author.fetchRelays();

	const contactsTags = await $author.fetchEvents();
	const followingPubkeys = parseFollowList(contactsTags).map(({ pubkey }) => pubkey);
	const followees = unique([...followingPubkeys, pubkey]);

	await loadFolloweesMetadataCache(followees);
	pruneFolloweeReplaceableEventsCache(followees);

	author.set($author);

	return followingPubkeys;
}
