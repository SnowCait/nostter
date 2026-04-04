import type { Event } from 'nostr-typedef';
import { createRxBackwardReq, latest, uniq } from 'rx-nostr';
import { SvelteMap } from 'svelte/reactivity';
import { rxNostr } from './timelines/MainTimeline';
import { Pinlist } from 'nostr-tools/kinds';
import { filter } from 'rxjs';

export const pinnedNotesEvents = new SvelteMap<string, Event | undefined>();

export function fetchPinnedNoteEvent(pubkey: string): void {
	if (pinnedNotesEvents.has(pubkey)) {
		return;
	}

	pinnedNotesEvents.set(pubkey, undefined);

	const req = createRxBackwardReq();
	rxNostr
		.use(req)
		.pipe(
			uniq(),
			latest(),
			filter(({ event }) => {
				const cache = pinnedNotesEvents.get(event.pubkey);
				return cache === undefined || cache.created_at < event.created_at;
			})
		)
		.subscribe(({ event }) => pinnedNotesEvents.set(event.pubkey, event));
	req.emit([{ kinds: [Pinlist], authors: [pubkey], limit: 1 }]);
	req.over();
}
