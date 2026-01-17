<script lang="ts">
	import { nip19 } from 'nostr-tools';
	import { deletedEventIdsByPubkey } from '$lib/author/Delete';
	import { isMuteEvent } from '$lib/stores/Author';
	import { userEvents } from '$lib/stores/UserEvents';
	import Note from '../items/Note.svelte';
	import Hashtag from './Hashtag.svelte';
	import Text from './Text.svelte';
	import Url from './Url.svelte';
	import { eventItemStore } from '$lib/cache/Events';
	import NoteLink from '../items/NoteLink.svelte';
	import DeletedContent from '../items/DeletedContent.svelte';
	import MutedContent from '../items/MutedContent.svelte';
	import { getSeenOnRelays } from '$lib/timelines/MainTimeline';

	interface Props {
		text: string;
		tag: string[];
	}

	let { text, tag }: Props = $props();

	let item = $derived($eventItemStore.get(tag[1]));
</script>

{#if tag.at(0) === 'p' && tag.at(1) !== undefined}
	<a href="/{nip19.npubEncode(tag[1])}">
		@{$userEvents.has(tag[1]) && $userEvents.get(tag[1])?.user?.name
			? $userEvents.get(tag[1])?.user.name
			: nip19.npubEncode(tag[1]).substring(0, 'npub1'.length + 7)}
	</a>
{:else if tag.at(0) === 'e' && tag.at(1) !== undefined}
	{#if item !== undefined}
		{#if $deletedEventIdsByPubkey.get(item.event.pubkey)?.has(item.event.id)}
			<blockquote>
				<DeletedContent />
			</blockquote>
		{:else if isMuteEvent(item.event)}
			<blockquote>
				<MutedContent />
			</blockquote>
		{:else}
			<a
				href="/{nip19.neventEncode({
					id: item.event.id,
					relays: getSeenOnRelays(item.event.id),
					author: item.event.pubkey,
					kind: item.event.kind
				})}"
			>
				<blockquote>
					<Note {item} readonly={true} />
				</blockquote>
			</a>
		{/if}
	{:else}
		<blockquote>
			<NoteLink eventId={tag[1]} />
		</blockquote>
	{/if}
{:else if tag.at(0) === 'r' && tag.at(1) !== undefined}
	<Url text={tag[1]} />
{:else if tag.at(0) === 't' && tag.at(1) !== undefined}
	<Hashtag text={`#${tag[1]}`} />
{:else}
	<Text {text} />
{/if}

<style>
	a:has(blockquote) {
		text-decoration: none;
	}
</style>
