<script lang="ts">
	import {
		batch,
		createRxBackwardReq,
		createRxOneshotReq,
		latest,
		latestEach,
		uniq
	} from 'rx-nostr';
	import { bufferCount, bufferTime } from 'rxjs';
	import { filterTags } from '$lib/EventHelper';
	import TimelineView from '../../TimelineView.svelte';
	import { nip19 } from 'nostr-tools';
	import { saveLastNotes } from '../../../../stores/LastNotes';
	import type { Metadata } from '$lib/Items';
	import type { LayoutData } from '../$types';
	import { metadataReqEmit, rxNostr } from '$lib/timelines/MainTimeline';
	import { metadataStore } from '$lib/cache/Events';
	import { maxFilters } from '$lib/Constants';

	export let data: LayoutData;

	let pubkey: string | undefined;
	let pubkeys: string[] = [];

	const lastNoteReq = createRxBackwardReq();
	rxNostr
		.use(lastNoteReq.pipe(bufferCount(maxFilters), batch()))
		.pipe(
			uniq(),
			latestEach(({ event }) => event.pubkey),
			bufferTime(10000)
		)
		.subscribe((packets) => {
			console.log('[rx-nostr last notes]', packets);
			saveLastNotes(packets.map((x) => x.event));
		});

	$: items = pubkeys
		.map((pubkey) => $metadataStore.get(pubkey))
		.filter((metadata): metadata is Metadata => metadata !== undefined);

	$: if (pubkey !== data.pubkey) {
		console.log('[followees page]', nip19.npubEncode(data.pubkey));
		pubkey = data.pubkey;

		const contactsReq = createRxOneshotReq({
			filters: [
				{
					kinds: [3],
					authors: [data.pubkey],
					limit: 1
				}
			]
		});
		rxNostr
			.use(contactsReq)
			.pipe(uniq(), latest())
			.subscribe((packet) => {
				console.log('[rx-nostr contacts]', packet);
				pubkeys = filterTags('p', packet.event.tags).reverse();
				metadataReqEmit(pubkeys);
				if (!data.authenticated) {
					return;
				}
				for (const pubkey of pubkeys) {
					lastNoteReq.emit([
						{
							kinds: [1],
							authors: [pubkey],
							limit: 1
						}
					]);
				}
			});
	}
</script>

<h1>followees</h1>

<TimelineView {items} load={async () => console.debug()} showLoading={false} />
