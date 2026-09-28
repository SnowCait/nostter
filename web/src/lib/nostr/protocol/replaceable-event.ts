import { compareEvents, type Event } from 'nostr-tools';

export function shouldReplaceCurrentEvent(candidate: Event, current: Event | undefined): boolean {
	return current === undefined || compareEvents(candidate, current) < 0;
}
