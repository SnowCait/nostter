<script lang="ts">
	import { nip19 } from 'nostr-tools';
	import { events } from '../../stores/Events';
	import { userEvents } from '../../stores/UserEvents';
	import Note from '../timeline/Note.svelte';
	import type { Event } from '../types';
	import Hashtag from './Hashtag.svelte';
	import Text from './Text.svelte';
	import { onMount } from 'svelte';
	import { Api } from '$lib/Api';
	import { pool } from '../../stores/Pool';
	import { readRelays } from '../../stores/Author';
	import Url from './Url.svelte';

	export let text: string;
	export let tag: string[];

	$: eventId = tag.at(1);

	let event: Event | undefined;
	if (tag.at(0) === 'e' && tag.at(1) !== undefined) {
		event = $events.find((x) => x.id === eventId);
	}

	onMount(async () => {
		if (event === undefined && eventId !== undefined) {
			const api = new Api($pool, $readRelays);
			event = await api.fetchEventById(eventId);
		}
	});
</script>

{#if tag.at(0) === 'p' && tag.at(1) !== undefined}
	<a href="/{nip19.npubEncode(tag[1])}">
		@{$userEvents.has(tag[1]) && $userEvents.get(tag[1])?.user.name
			? $userEvents.get(tag[1])?.user.name
			: nip19.npubEncode(tag[1]).substring(0, 'npub1'.length + 7)}
	</a>
{:else if tag.at(0) === 'e' && tag.at(1) !== undefined}
	{#if event !== undefined}
		<div class="quote">
			<Note {event} readonly={true} />
		</div>
	{:else}
		<a href="/{nip19.noteEncode(tag[1])}">
			{nip19.noteEncode(tag[1]).substring(0, 'note1'.length + 7)}
		</a>
	{/if}
{:else if tag.at(0) === 'r' && tag.at(1) !== undefined}
	<Url text={tag[1]} />
{:else if tag.at(0) === 't' && tag.at(1) !== undefined}
	<Hashtag text={`#${tag[1]}`} />
{:else}
	<Text {text} />
{/if}

<style>
	.quote {
		border: 1px solid rgb(239, 243, 244);
		border-radius: 5px;
	}
</style>
