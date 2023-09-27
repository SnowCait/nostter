<script lang="ts">
	import { writable } from 'svelte/store';
	import { onMount } from 'svelte';
	import type { Item } from '$lib/Items';
	import { author, isMuteEvent } from '../stores/Author';
	import Loading from './Loading.svelte';
	import EventComponent from './timeline/EventComponent.svelte';
	import { nip19, type Event } from 'nostr-tools';
	import { goto } from '$app/navigation';

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

	const viewDetail = async (
		clickEvent: MouseEvent & {
			currentTarget: EventTarget & HTMLLIElement;
		},
		nostrEvent: Event
	) => {
		let target: HTMLElement | null = clickEvent.target as HTMLElement;
		if (target) {
			while (target && !target.classList.contains('timeline')) {
				const tagName = target.tagName.toLocaleLowerCase();
				if (tagName === 'a' || tagName === 'button') {
					return;
				}
				if (tagName === 'p' && String(document.getSelection()).length) {
					return;
				}
				if (tagName === 'blockquote') {
					const eTags = nostrEvent.tags.filter(
						([tagName, tagContent]) => tagName === 'e' && tagContent !== undefined
					);
					const [_, refEventId] = eTags.at(eTags.length - 1) || ['', ''];
					if (!refEventId) {
						continue;
					}
					const noteId = nip19.noteEncode(refEventId);
					await goto(`/${noteId}`);
					return;
				}
				target = target.parentElement;
			}
		}
		if (transitionable) {
			const noteId = nip19.noteEncode(nostrEvent.id);
			await goto(`/${noteId}`);
		}
	};
</script>

<svelte:window bind:innerHeight bind:scrollY={$scrollY} />

<ul class="card timeline" bind:this={timelineRef}>
	{#each items as item (item.event.id)}
		{#if !isMuteEvent(item.event)}
			<li
				class={transitionable ? 'transitionable-post' : ''}
				class:related={$author?.isNotified(item.event)}
				on:mouseup={(e) => viewDetail(e, item.event)}
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

	:global(blockquote) {
		cursor: pointer;
	}

	:global(.transitionable-post blockquote:hover) {
		background: var(--accent-surface-high);
	}

	:global(blockquote:hover) {
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
