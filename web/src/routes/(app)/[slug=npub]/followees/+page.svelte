<script lang="ts">
	import { pool } from '../../../../stores/Pool';
	import { readRelays, rom } from '../../../../stores/Author';
	import { filterTags } from '$lib/EventHelper';
	import TimelineView from '../../TimelineView.svelte';
	import { Kind, type Filter, nip19 } from 'nostr-tools';
	import { lastNotesMap, saveLastNote } from '../../../../stores/LastNotes';
	import { chunk } from '$lib/Array';
	import type { Metadata } from '$lib/Items';
	import type { LayoutData } from '../$types';
	import { createRxOneshotReq, latest, uniq } from 'rx-nostr';
	import { metadataReqEmit, rxNostr } from '$lib/timelines/MainTimeline';
	import { metadataStore } from '$lib/cache/Events';

	export let data: LayoutData;

	let pubkey: string | undefined;
	let pubkeys: string[] = [];

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
				pubkeys = filterTags('p', packet.event.tags);
				metadataReqEmit(pubkeys);
				if (!$rom) {
					fetchLastNotes(pubkeys);
				}
			});
	}

	async function fetchLastNotes(pubkeys: string[]) {
		const chunkedPubkeysList = chunk(
			pubkeys.filter((pubkey) => !$lastNotesMap.has(pubkey)),
			5
		);
		for (const chunkedPubkeys of chunkedPubkeysList) {
			const lastNotes = await $pool.list(
				$readRelays,
				chunkedPubkeys.map((pubkey) => {
					return {
						authors: [pubkey],
						kinds: [Kind.Text],
						limit: 1
					} as Filter;
				})
			);
			console.log('[last notes]', chunkedPubkeys, lastNotes);
			for (const lastNote of lastNotes) {
				saveLastNote(lastNote);
			}
		}
	}
</script>

<h1>followees</h1>

<TimelineView {items} load={async () => console.debug()} showLoading={false} />
