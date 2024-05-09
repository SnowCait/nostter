<script lang="ts">
	import { nip19 } from 'nostr-tools';
	import { userEvents } from '$lib/stores/UserEvents';
	import Note from '../../../routes/(app)/timeline/Note.svelte';
	import Hashtag from './Hashtag.svelte';
	import Text from './Text.svelte';
	import Url from './Url.svelte';
	import { eventItemStore } from '$lib/cache/Events';

	export let text: string;
	export let tag: string[];

	$: item = $eventItemStore.get(tag[1]);

	console.debug('[deprecated reference]', tag[1]);
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
