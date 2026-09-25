import { compareEvents, type Event } from 'nostr-tools';

/** Whether a candidate should replace the current version of the same event address. */
export function shouldReplaceCurrentEvent(candidate: Event, current: Event): boolean {
	return compareEvents(candidate, current) < 0;
}
