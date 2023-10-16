import { get } from 'svelte/store';
import type { Event } from 'nostr-typedef';
import { batch, createRxBackwardReq, createRxNostr, latestEach, uniq } from 'rx-nostr';
import { bufferTime } from 'rxjs';
import { timeout } from '$lib/Constants';
import { filterTags } from '$lib/EventHelper';
import { EventItem, Metadata } from '$lib/Items';
import { eventItemStore, metadataStore } from '../cache/Events';
import { Content } from '$lib/Content';

export const rxNostr = createRxNostr({ timeout }); // Based on NIP-65

const metadataReq = createRxBackwardReq();
const eventsReq = createRxBackwardReq();

export function referencesReqEmit(event: Event): void {
	console.debug('[rx-nostr references REQ emit]', event);
	for (const pubkey of [
		...new Set([
			event.pubkey,
			...filterTags('p', event.tags),
			...Content.findNpubsAndNprofilesToPubkeys(event.content)
		])
	]) {
		console.debug('[rx-nostr metadata REQ emit]', pubkey);
		metadataReq.emit({
			kinds: [0],
			authors: [pubkey],
			limit: 1
		});
	}

	const $eventItemStore = get(eventItemStore);
	eventsReq.emit({
		ids: [
			...new Set([
				...event.tags
					.filter(
						([tagName, id]) =>
							tagName === 'e' && id !== undefined && !$eventItemStore.has(id)
					)
					.map(([, id]) => id),
				...Content.findNotesAndNeventsToIds(event.content)
			])
		]
	});
}

rxNostr
	.use(metadataReq.pipe(bufferTime(1000, null, 10), batch()))
	.pipe(latestEach(({ event }: { event: Event }) => event.pubkey))
	.subscribe(async (packet) => {
		const cache = get(metadataStore).get(packet.event.pubkey);
		if (cache === undefined || cache.event.created_at < packet.event.created_at) {
			const metadata = new Metadata(packet.event);
			console.log('[rx-nostr metadata]', packet, metadata.content?.name);
			const $metadataStore = get(metadataStore);
			$metadataStore.set(metadata.event.pubkey, metadata);
			metadataStore.set($metadataStore);
		}
	});

rxNostr
	.use(eventsReq.pipe(bufferTime(1000, null, 10), batch()))
	.pipe(uniq())
	.subscribe(async (packet) => {
		console.log('[rx-nostr event]', packet);
		const eventItem = new EventItem(packet.event);
		const $eventItemStore = get(eventItemStore);
		$eventItemStore.set(eventItem.event.id, eventItem);
		eventItemStore.set($eventItemStore);
	});
