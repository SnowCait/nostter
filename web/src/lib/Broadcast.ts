import type { Event } from 'nostr-typedef';
import { rxNostr } from './timelines/MainTimeline';

export function broadcast(event: Event): void {
	console.debug('[broadcast]', event);
	rxNostr.send(event).subscribe({
		next: ({ from, eventId, ok, notice }) => {
			console.debug('[broadcast next]', from, eventId, ok, notice);
		},
		complete: () => {
			console.debug('[broadcast complete]');
			// TODO: Toast notification
		},
		error: (error) => {
			console.debug('[broadcast error]', error);
		}
	});
}
