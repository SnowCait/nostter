<script lang="ts">
	import { nip19 } from 'nostr-tools';
	import type { EventItem } from '$lib/Items';
	import { events } from '../../../stores/Events';
	import { userEvents } from '../../../stores/UserEvents';
	import Note from '../timeline/Note.svelte';
	import Hashtag from './Hashtag.svelte';
	import Text from './Text.svelte';
	import { onMount } from 'svelte';
	import { Api } from '$lib/Api';
	import { pool } from '../../../stores/Pool';
	import { readRelays } from '../../../stores/Author';
	import Url from './Url.svelte';

	export let text: string;
	export let tag: string[];

	$: eventId = tag.at(1);

	let item: EventItem | undefined;
	if (tag.at(0) === 'e' && tag.at(1) !== undefined) {
		item = $events.find((x) => x.event.id === eventId);
	}

	onMount(async () => {
		console.debug('[deprecated reference]');
		if (item === undefined && eventId !== undefined) {
			const api = new Api($pool, $readRelays);
			item = await api.fetchEventItemById(eventId);
		}
	});
</script>

{#if tag.at(0) === 'p' && tag.at(1) !== undefined}
	<a href="/{nip19.npubEncode(tag[1])}">
		@{$userEvents.has(tag[1]) && $userEvents.get(tag[1])?.user?.name
			? $userEvents.get(tag[1])?.user.name
			: nip19.npubEncode(tag[1]).substring(0, 'npub1'.length + 7)}
	</a>
{:else if tag.at(0) === 'e' && tag.at(1) !== undefined}
	{#if item !== undefined}
		<blockquote>
			<Note {item} readonly={true} />
		</blockquote>
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
