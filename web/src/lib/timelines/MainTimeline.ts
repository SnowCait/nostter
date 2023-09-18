import { get } from 'svelte/store';
import type { Event } from 'nostr-tools';
import { batch, createRxBackwardReq, createRxNostr, latestEach } from 'rx-nostr';
import { bufferTime } from 'rxjs';
import { Metadata } from '../Items';
import { metadataEvents } from '../cache/Events';
import { events } from '../../stores/Events';
import type { User } from '../../routes/types';

export const timeout = 3400;
export const rxNostr = createRxNostr({ timeout }); // for home & notification timeline
export const metadataReq = createRxBackwardReq();

const $events = get(events);
rxNostr
	.use(metadataReq.pipe(bufferTime(1000, null, 10), batch()))
	.pipe(latestEach(({ event }: { event: Event }) => event.pubkey))
	.subscribe(async (packet) => {
		const cache = metadataEvents.get(packet.event.pubkey);
		if (cache === undefined || cache.created_at < packet.event.created_at) {
			metadataEvents.set(packet.event.pubkey, packet.event);

			const metadata = new Metadata(packet.event);
			console.log('[rx-nostr metadata]', packet, metadata.content?.name);
			const user = {
				...metadata.content,
				zapEndpoint: (await metadata.zapUrl())?.href ?? null
			} as User;
			for (const event of $events) {
				if (event.pubkey !== packet.event.pubkey) {
					continue;
				}
				event.user = user;
			}
			events.set($events);
		}
	});
