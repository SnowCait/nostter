import type { Event } from 'nostr-tools';

type EventOrder = Pick<Event, 'created_at' | 'id'>;

/** NIP-01 preference for versions of the same replaceable or addressable event. */
export function isPreferredReplaceableEvent(candidate: EventOrder, current: EventOrder): boolean {
	return (
		candidate.created_at > current.created_at ||
		(candidate.created_at === current.created_at && candidate.id < current.id)
	);
}
