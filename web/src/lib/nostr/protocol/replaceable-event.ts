import { compareEvents, type Event } from 'nostr-tools';

export function shouldReplaceCurrentEvent(candidate: Event, current: Event): boolean {
	return compareEvents(candidate, current) < 0;
}
