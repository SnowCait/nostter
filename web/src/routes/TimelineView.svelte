<script lang="ts">
	import { writable } from 'svelte/store';
	import { onMount } from 'svelte';
	import type { Item } from '$lib/Items';
	import { author, isMuteEvent } from '../stores/Author';
	import Loading from './Loading.svelte';
	import EventComponent from './timeline/EventComponent.svelte';
	import { nip19 } from 'nostr-tools';

	export let items: Item[] = [];
	export let readonly = false;
	export let load: () => Promise<void>;
	export let showLoading = true;
	export let createdAtFormat: 'auto' | 'time' = 'auto';
	export let transitionable = true;

	let loading = false;
	let innerHeight: number;
	let scrollY = writable(0);

	let timelineRef: HTMLUListElement | null = null;

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

	const viewDetail = (
		clickEvent: MouseEvent & {
			currentTarget: EventTarget & HTMLLIElement;
		},
		eventId: string
	) => {
		const target = clickEvent.target as HTMLElement;

		let parent = target.parentElement;
		if (parent) {
			while (parent && !parent.classList.contains('timeline')) {
				const tagName = parent.tagName.toLocaleLowerCase();
				if (tagName === 'a' || tagName === 'button') {
					return;
				}
				if (tagName === 'p' && String(document.getSelection()).length) {
					return;
				}
				parent = parent.parentElement;
			}
		}
		const noteId = nip19.noteEncode(eventId);
		window.location.href = `/${noteId}`;
		return;
	};
</script>

<svelte:window bind:innerHeight bind:scrollY={$scrollY} />

<ul class="card timeline" bind:this={timelineRef}>
	{#each items as item (item.event.id)}
		{#if !isMuteEvent(item.event)}
			<li
				class={transitionable ? 'transitionable-post' : ''}
				class:related={$author?.isNotified(item.event)}
				on:mouseup={transitionable ? (e) => viewDetail(e, item.event.id) : null}
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

	.transitionable-post {
		cursor: pointer;
	}

	.transitionable-post:hover {
		background: var(--accent-surface-low);
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
