import { get, writable } from 'svelte/store';
import type { Event } from 'nostr-typedef';
import type { pubkey } from './Types';
import { createRxBackwardReq, latestEach } from 'rx-nostr';
import { rxNostr } from './timelines/MainTimeline';
import { Api } from './Api';

export const replaceableEvents = writable(new Map<number, Event>());

export function replaceableEventsReqEmit(pubkey: pubkey) {
	const replaceableEventsReq = createRxBackwardReq();
	rxNostr
		.use(replaceableEventsReq)
		.pipe(latestEach(({ event }) => event.kind))
		.subscribe((packet) => {
			console.debug('[rx-nostr replaceable event]', packet);
			const $replaceableEvents = get(replaceableEvents);
			$replaceableEvents.set(packet.event.kind, packet.event);
			replaceableEvents.set($replaceableEvents);
		});
	replaceableEventsReq.emit([
		{
			kinds: Api.replaceableKinds,
			authors: [pubkey]
		}
	]);
	replaceableEventsReq.over();
}
