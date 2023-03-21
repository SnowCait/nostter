<script lang="ts">
	import { writable } from 'svelte/store';
	import { onMount } from 'svelte';
	import Note from './timeline/Note.svelte';
	import RepostedNote from './timeline/RepostedNote.svelte';
	import type { Event } from './types';
	import { Kind } from 'nostr-tools';
	import Reaction from './timeline/Reaction.svelte';

	export let events: Event[] = [];
	export let readonly = false;
	export let focusEventId: string | undefined = undefined;
	export let load: () => Promise<void>;

	let loading = false;
	let innerHeight: number;
	let scrollY = writable(0);
	onMount(() => {
		console.log('Timeline.onMount');
		scrollY.subscribe(async (y) => {
			const maxHeight = document.documentElement.scrollHeight;
			const scrollRate = Math.floor((100 * (y + innerHeight)) / maxHeight);
			console.debug('[y]', y, innerHeight, maxHeight, scrollRate);

			if (scrollRate > 90 && !loading) {
				console.log('Load more timeline');
				loading = true;
				await load();
				console.log('Timeline loaded');
				loading = false;
			}
		});
	});
</script>

<svelte:window bind:innerHeight bind:scrollY={$scrollY} />

<ul>
	{#each events as event (event.id)}
		<li class:focus={event.id === focusEventId}>
			{#if event.kind === 6}
				<RepostedNote {event} {readonly} />
			{:else if event.kind === Kind.Reaction}
				<Reaction {event} {readonly} />
			{:else}
				<Note {event} {readonly} />
			{/if}
		</li>
	{/each}
</ul>

<style>
	ul {
		list-style: none;
		padding: 0;
		border: 1px solid rgb(239, 243, 244);
		border-bottom-style: none;
	}

	li {
		border-bottom: 1px solid rgb(239, 243, 244);
		animation-name: add;
		animation-duration: 0.8s;
	}

	li.focus {
		border: 1px solid lightgray;
	}

	@keyframes add {
		0% {
			opacity: 0;
		}

		100% {
			opacity: 1;
		}
	}
</style>
