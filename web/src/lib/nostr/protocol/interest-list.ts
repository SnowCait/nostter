import type * as Nostr from 'nostr-typedef';

export function parseFollowingHashtags(event: Pick<Nostr.Event, 'tags'> | undefined): string[] {
	return event?.tags.filter(([name]) => name === 't').map(([, hashtag]) => hashtag) ?? [];
}
