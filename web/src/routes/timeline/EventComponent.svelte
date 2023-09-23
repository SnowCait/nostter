<script lang="ts">
	import { Kind } from 'nostr-tools';
	import type { Event } from '../types';
	import Profile from './Profile.svelte';
	import RepostedNote from './RepostedNote.svelte';
	import Reaction from './Reaction.svelte';
	import Channel from './Channel.svelte';
	import Zap from './Zap.svelte';
	import Note from './Note.svelte';
	import { EventItem, Metadata } from '$lib/Items';
	import CustomEmojiList from './CustomEmojiList.svelte';

	export let eventItem: Event | EventItem;
	export let readonly: boolean;
	export let createdAtFormat: 'auto' | 'time' = 'auto';

	$: event = eventItem instanceof EventItem ? eventItem.event : eventItem;
</script>

{#if event.kind === Kind.Metadata}
	<Profile metadata={new Metadata(event)} />
{:else if event.kind === 6}
	<RepostedNote {event} {readonly} {createdAtFormat} />
{:else if event.kind === Kind.Reaction}
	<Reaction {event} {readonly} {createdAtFormat} />
{:else if event.kind === Kind.ChannelCreation || event.kind === Kind.ChannelMetadata}
	<Channel {event} />
{:else if event.kind === Kind.Zap}
	<Zap {event} {readonly} {createdAtFormat} />
{:else if event.kind === 30030}
	<CustomEmojiList tags={event.tags} />
{:else}
	<Note {event} {readonly} {createdAtFormat} />
{/if}
