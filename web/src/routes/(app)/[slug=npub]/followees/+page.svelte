<script lang="ts">
	import { error } from '@sveltejs/kit';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/stores';
	import { Api } from '$lib/Api';
	import { User as UserDecoder } from '$lib/User';
	import type { UserEvent } from '../../../types';
	import { pool } from '../../../../stores/Pool';
	import { readRelays, rom } from '../../../../stores/Author';
	import { filterTags } from '$lib/EventHelper';
	import TimelineView from '../../TimelineView.svelte';
	import { Kind, type Filter } from 'nostr-tools';
	import { lastNotesMap, saveLastNote } from '../../../../stores/LastNotes';
	import { chunk } from '$lib/Array';
	import { Metadata } from '$lib/Items';

	let events: UserEvent[] = [];
	let showLoading = true;

	$: items = events.map((x) => new Metadata(x));

	afterNavigate(async () => {
		const slug = $page.params.slug;
		console.log('[followees page]', slug);

		const { pubkey, relays } = await UserDecoder.decode(slug);

		if (pubkey === undefined) {
			throw error(404);
		}

		const api = new Api($pool, Array.from(new Set([...relays, ...$readRelays])));
		const event = await api.fetchContactsEvent(pubkey);
		console.log('[contacts]', event);

		if (event === undefined || event.tags.length === 0) {
			showLoading = false;
			return;
		}

		const pubkeys = filterTags('p', event.tags);
		const userEventsMap = await api.fetchUserEventsMap(pubkeys);
		events = [...userEventsMap].map(([, userEvent]) => userEvent);
		showLoading = false;

		// last note
		if (!$rom) {
			fetchLastNotes(pubkeys);
		}
	});

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

<TimelineView {items} load={async () => console.debug()} {showLoading} />
