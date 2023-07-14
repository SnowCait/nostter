<script lang="ts">
	import { Kind } from 'nostr-tools';
	import type { Event } from '../types';
	import Profile from './Profile.svelte';
	import RepostedNote from './RepostedNote.svelte';
	import Reaction from './Reaction.svelte';
	import Channel from './Channel.svelte';
	import Zap from './Zap.svelte';
	import Note from './Note.svelte';
	import { Metadata } from '$lib/Items';

	export let event: Event;
	export let readonly: boolean;
	export let createdAtFormat: 'auto' | 'time' = 'auto';
</script>

{#if event.kind === Kind.Metadata}
	<Profile metadata={new Metadata(event)} />
{:else if event.kind === 6}
	<RepostedNote {event} {readonly} {createdAtFormat} />
{:else if event.kind === Kind.Reaction}
	<Reaction {event} {readonly} {createdAtFormat} />
{:else if event.kind === Kind.ChannelCreation}
	<Channel {event} />
{:else if event.kind === Kind.Zap}
	<Zap {event} {readonly} {createdAtFormat} />
{:else}
	<Note {event} {readonly} {createdAtFormat} />
{/if}
