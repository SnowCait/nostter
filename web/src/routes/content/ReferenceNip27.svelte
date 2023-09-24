<script lang="ts">
	import { Api } from '$lib/Api';
	import { nip19 } from 'nostr-tools';
	import { onMount } from 'svelte';
	import { events } from '../../stores/Events';
	import type { Event, UserEvent } from '../types';
	import { pool } from '../../stores/Pool';
	import { readRelays } from '../../stores/Author';
	import Text from './Text.svelte';
	import Nip94 from '../Nip94.svelte';
	import Naddr from './Naddr.svelte';
	import EventComponent from '../timeline/EventComponent.svelte';
	import type { AddressPointer } from 'nostr-tools/lib/nip19';

	export let text: string;

	let dataType: 'user' | 'event' | 'addr';
	let pubkey = '';
	let userEvent: UserEvent | undefined = undefined;
	let eventId = '';
	let event: Event | undefined;
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
				event = $events.find((x) => x.id === eventId);
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
				event = $events.find((x) => x.id === eventId);
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

	onMount(async () => {
		const api = new Api($pool, $readRelays);

		if (dataType === 'user') {
			userEvent = await api.fetchUserEvent(pubkey);
		}

		if (dataType === 'event' && event === undefined) {
			event = await api.fetchEventById(eventId);
		}

		if (dataType === 'addr') {
			event = (await api.fetchEvent([
				{
					kinds: [addressPointer.kind],
					authors: [addressPointer.pubkey],
					'#d': [addressPointer.identifier]
				}
			])) as Event;
		}
	});
</script>

{#if dataType === 'user'}
	<a href="/{nip19.npubEncode(pubkey)}">
		@{userEvent !== undefined
			? userEvent.user?.name
			: nip19.npubEncode(pubkey).substring(0, 'npub1'.length + 7)}
	</a>
{:else if dataType === 'event'}
	{#if event !== undefined}
		{#if event.kind === 1063}
			<Nip94 {event} />
		{:else}
			<blockquote><EventComponent eventItem={event} readonly={true} /></blockquote>
		{/if}
	{:else}
		<a href="/{nip19.noteEncode(eventId)}">
			{nip19.noteEncode(eventId).substring(0, 'note1'.length + 7)}
		</a>
	{/if}
{:else if dataType === 'addr'}
	{#if event !== undefined && event.kind === 30030}
		<EventComponent eventItem={event} readonly={true} />
	{:else}
		<Naddr naddr={slug} />
	{/if}
{:else}
	<Text {text} />
{/if}
