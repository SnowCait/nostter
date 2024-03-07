import { get, writable } from 'svelte/store';
import type { id, pubkey } from './Types';
import { createRxBackwardReq, type EventPacket } from 'rx-nostr';
import { rxNostr } from './timelines/MainTimeline';
import { replaceableKinds } from './Constants';

export const replaceableEvents = writable(new Map<id, EventPacket[]>());

export function replaceableEventsReqEmit(pubkey: pubkey) {
	const replaceableEventsReq = createRxBackwardReq();
	rxNostr.use(replaceableEventsReq).subscribe((packet) => {
		console.debug('[rx-nostr replaceable event]', packet);
		const $replaceableEvents = get(replaceableEvents);
		const packets = $replaceableEvents.get(packet.event.id);
		$replaceableEvents.set(
			packet.event.id,
			packets === undefined ? [packet] : [...packets, packet]
		);
		replaceableEvents.set($replaceableEvents);
	});
	replaceableEventsReq.emit([
		{
			kinds: replaceableKinds,
			authors: [pubkey]
		}
	]);
	replaceableEventsReq.over();
}
