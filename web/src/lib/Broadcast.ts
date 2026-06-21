import type * as Nostr from 'nostr-typedef';
import { get } from 'svelte/store';
import { _ } from 'svelte-i18n';
import { rxNostr } from './timelines/MainTimeline';
import { addToast } from './components/Toaster.svelte';

export function broadcast(event: Nostr.Event): void {
	console.debug('[broadcast]', event);
	const results = new Map<string, boolean>();
	rxNostr.send(event).subscribe({
		next: ({ from, eventId, ok, notice }) => {
			console.debug('[broadcast next]', from, eventId, ok, notice);
			results.set(from, ok);
		},
		complete: () => {
			console.debug('[broadcast complete]');
			const total = results.size;
			const accepted = [...results.values()].filter((ok) => ok).length;
			addToast({
				data: {
					title: get(_)('actions.broadcast.completed.title'),
					description: get(_)('actions.broadcast.completed.description', {
						values: { accepted, total }
					})
				}
			});
		},
		error: (error) => {
			console.debug('[broadcast error]', error);
			addToast({
				data: {
					title: get(_)('actions.broadcast.failed.title'),
					description: get(_)('actions.broadcast.failed.description')
				}
			});
		}
	});
}
