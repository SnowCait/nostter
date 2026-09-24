import { Author } from '$lib/Author';
import { applyAccountEvents } from './apply-account-events';
import { unique } from '$lib/array';
import { parseFollowList } from '$lib/nostr/protocol/nip02';
import { loadFolloweesMetadataCache, pruneFolloweeReplaceableEventsCache } from '$lib/cache/Events';
import type { ListContentDecrypter } from '$lib/List';

export async function initializeAccount(
	pubkey: string,
	decryptPrivateListContent?: ListContentDecrypter
): Promise<string[]> {
	const author = new Author(pubkey);

	await author.fetchRelays();

	const events = await author.fetchEvents();
	const contactsTags = await applyAccountEvents(pubkey, events, decryptPrivateListContent);
	const followingPubkeys = parseFollowList(contactsTags).map(({ pubkey }) => pubkey);
	const followees = unique([...followingPubkeys, pubkey]);

	await loadFolloweesMetadataCache(followees);
	pruneFolloweeReplaceableEventsCache(followees);

	return followingPubkeys;
}
