<script lang="ts">
	import { Api } from '$lib/Api';
	import { nip19 } from 'nostr-tools';
	import { onMount } from 'svelte';
	import { events } from '../../stores/Events';
	import type { Event } from '../types';
	import { pool } from '../../stores/Pool';
	import { readRelays } from '../../stores/Author';
	import Text from './Text.svelte';
	import Nip94 from '../Nip94.svelte';
	import Naddr from './Naddr.svelte';
	import EventComponent from '../timeline/EventComponent.svelte';
	import type { AddressPointer } from 'nostr-tools/lib/nip19';
	import { EventItem, Metadata } from '$lib/Items';
	import { eventItemStore, metadataStore } from '$lib/cache/Events';

	export let text: string;

	let dataType: 'user' | 'event' | 'addr';
	let pubkey: string | undefined;
	let metadata: Metadata | undefined;
	let eventId: string | undefined;
	let item: EventItem | undefined;
	let addressPointer: AddressPointer;
	let slug = text.substring('nostr:'.length);

	try {
		const { type, data } = nip19.decode(slug);
		switch (type) {
			case 'npub': {
				dataType = 'user';
				pubkey = data as string;
				break;
			}
			case 'note': {
				dataType = 'event';
				eventId = data as string;
				item = $events.find((x) => x.event.id === eventId);
				break;
			}
			case 'nprofile': {
				dataType = 'user';
				const profile = data as nip19.ProfilePointer;
				pubkey = profile.pubkey;
				break;
			}
			case 'nevent': {
				dataType = 'event';
				const e = data as nip19.EventPointer;
				eventId = e.id;
				item = $events.find((x) => x.event.id === eventId);
				break;
			}
			case 'naddr': {
				dataType = 'addr';
				addressPointer = data;
				break;
			}
		}
	} catch (e) {
		console.warn('[decode failed]', text, e);
	}

	$: if (dataType === 'user' && pubkey !== undefined) {
		metadata = $metadataStore.get(pubkey);
	}

	$: if (dataType === 'event' && item === undefined && eventId !== undefined) {
		item = $eventItemStore.get(eventId);
	}

	onMount(async () => {
		if (dataType === 'addr') {
			const api = new Api($pool, $readRelays);
			const e = (await api.fetchEvent([
				{
					kinds: [addressPointer.kind],
					authors: [addressPointer.pubkey],
					'#d': [addressPointer.identifier]
				}
			])) as Event;
			if (e !== undefined) {
				item = new EventItem(e);
			}
		}
	});
</script>

{#if dataType === 'user' && pubkey !== undefined}
	<a href="/{nip19.npubEncode(pubkey)}">
		@{metadata !== undefined
			? metadata.content?.name
			: nip19.npubEncode(pubkey).substring(0, 'npub1'.length + 7)}
	</a>
{:else if dataType === 'event' && eventId !== undefined}
	{#if item !== undefined}
		{#if Number(item.event.kind) === 1063}
			<Nip94 event={item.event} />
		{:else}
			<blockquote><EventComponent {item} readonly={true} /></blockquote>
		{/if}
	{:else}
		<a href="/{nip19.noteEncode(eventId)}">
			{nip19.noteEncode(eventId).substring(0, 'note1'.length + 7)}
		</a>
	{/if}
{:else if dataType === 'addr'}
	{#if item !== undefined && Number(item.event.kind) === 30030}
		<EventComponent {item} readonly={true} />
	{:else}
		<Naddr naddr={slug} />
	{/if}
{:else}
	<Text {text} />
{/if}
