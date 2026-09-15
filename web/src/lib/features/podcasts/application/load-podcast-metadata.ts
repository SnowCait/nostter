import type * as Nostr from 'nostr-typedef';
import { fetchLastEvent } from '$lib/RxNostrHelper';
import {
	parsePodcastMetadata,
	podcastMetadataKind,
	type PodcastMetadata
} from '$lib/nostr/protocol/nipf4';
import { getSeenOnRelays } from '$lib/nostr/relay/relay-hints';

export async function loadPodcastMetadata(
	episode: Pick<Nostr.Event, 'id' | 'pubkey'>
): Promise<PodcastMetadata | undefined> {
	const event = await fetchLastEvent(
		{ kinds: [podcastMetadataKind], authors: [episode.pubkey], limit: 1 },
		{ defaultReadRelays: true, relays: getSeenOnRelays(episode.id) }
	);
	return event === undefined ? undefined : parsePodcastMetadata(event);
}
