<script lang="ts">
	import { writable } from 'svelte/store';
	import { onMount } from 'svelte';
	import type { Item } from '$lib/Items';
	import { author, isMuteEvent } from '../stores/Author';
	import Loading from './Loading.svelte';
	import EventComponent from './timeline/EventComponent.svelte';

	export let items: Item[] = [];
	export let readonly = false;
	export let focusEventId: string | undefined = undefined;
	export let load: () => Promise<void>;
	export let showLoading = true;
	export let createdAtFormat: 'auto' | 'time' = 'auto';

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

<ul class="card">
	{#each items as item (item.event.id)}
		{#if !isMuteEvent(item.event)}
			<li
				class:focus={item.event.id === focusEventId}
				class:related={$author?.isNotified(item.event)}
			>
				<EventComponent {item} {readonly} {createdAtFormat} />
			</li>
		{/if}
	{/each}
</ul>
{#if showLoading}
	<div class="loading"><Loading /></div>
{/if}

<style>
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		border: var(--default-border);
		border-bottom-style: none;
	}

	li {
		border-bottom: var(--default-border);
		animation-name: add;
		animation-duration: 0.8s;
		overflow-x: hidden;
		text-overflow: ellipsis;
	}

	li.focus {
		border: 1px solid lightgray;
	}

	li.related {
		border-left: 2px solid lightcoral;
	}

	.loading {
		width: 24px;
		margin: 1rem auto;
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
