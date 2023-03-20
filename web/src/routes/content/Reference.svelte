<script lang="ts">
	import { IconExternalLink } from '@tabler/icons-svelte';
	import { nip19 } from 'nostr-tools';
	import { events } from '../../stores/Events';
	import { userEvents } from '../../stores/UserEvents';
	import NoteView from '../NoteView.svelte';
	import type { Event } from '../types';
	import Hashtag from './Hashtag.svelte';
	import Text from './Text.svelte';

	export let text: string;
	export let tag: string[];

	let event: Event | undefined;
	if (tag.at(0) === 'e' && tag.at(1) !== undefined) {
		const eventId = tag[1];
		event = $events.find((x) => x.id === eventId);
	}
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
			<NoteView {event} readonly={true} />
		</div>
	{:else}
		<a href="/{nip19.noteEncode(tag[1])}">
			{nip19.noteEncode(tag[1]).substring(0, 'note1'.length + 7)}
		</a>
	{/if}
{:else if tag.at(0) === 'r' && tag.at(1) !== undefined}
	<a href={tag[1]}>
		{tag[1]}<IconExternalLink size={15} />
	</a>
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
