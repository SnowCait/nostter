<script lang="ts">
	import { Api } from '$lib/Api';
	import { nip19 } from 'nostr-tools';
	import { onMount } from 'svelte';
	import { events } from '../../stores/Events';
	import { userEvents } from '../../stores/UserEvents';
	import Note from '../timeline/Note.svelte';
	import type { Event, UserEvent } from '../types';
	import { pool } from '../../stores/Pool';
	import { relayUrls } from '../../stores/Author';

	export let text: string;

	const { type, data } = nip19.decode(text.substring('nostr:'.length));
	let pubkey = '';
	let userEvent: UserEvent | undefined = undefined;
	let eventId = '';
	let event: Event | undefined;
	switch (type) {
		case 'npub': {
			pubkey = data as string;
			break;
		}
		case 'note': {
			eventId = data as string;
			event = $events.find((x) => x.id === eventId);
			break;
		}
		case 'nprofile': {
			const profile = data as nip19.ProfilePointer;
			pubkey = profile.pubkey;
			break;
		}
		case 'nevent': {
			const e = data as nip19.EventPointer;
			eventId = e.id;
			event = $events.find((x) => x.id === eventId);
			break;
		}
	}

	onMount(async () => {
		const api = new Api($pool, $relayUrls);

		if (type === 'npub' || type === 'nprofile') {
			userEvent = await api.fetchUserEvent(pubkey);
		}

		if (type === 'note' || (type === 'nevent' && event === undefined)) {
			event = await api.fetchEvent(eventId);
		}
	});
</script>

{#if type === 'npub' || type === 'nprofile'}
	<a href="/{nip19.npubEncode(pubkey)}">
		@{userEvent !== undefined
			? userEvent.user.name
			: nip19.npubEncode(pubkey).substring(0, 'npub1'.length + 7)}
	</a>
{:else if type === 'note' || type === 'nevent'}
	{#if event !== undefined}
		<div class="quote">
			<Note {event} readonly={true} />
		</div>
	{:else}
		<a href="/{nip19.noteEncode(eventId)}">
			{nip19.noteEncode(eventId).substring(0, 'note1'.length + 7)}
		</a>
	{/if}
{/if}

<style>
	.quote {
		border: 1px solid rgb(239, 243, 244);
		border-radius: 5px;
	}
</style>
