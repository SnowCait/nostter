<script lang="ts">
	import { writable } from 'svelte/store';
	import { onMount } from 'svelte';
	import { nip19, type Event } from 'nostr-tools';
	import { VirtualScroll } from 'svelte-virtual-scroll-list';
	import { goto } from '$app/navigation';
	import type { Item } from '$lib/Items';
	import { channelIdStore } from '$lib/Channel';
	import { findChannelId } from '$lib/EventHelper';
	import { author, isMuteEvent } from '$lib/stores/Author';
	import Loading from '$lib/components/Loading.svelte';
	import { emojiPickerOpen } from '$lib/components/EmojiPicker.svelte';
	import EventComponent from './timeline/EventComponent.svelte';

	export let items: Item[] = [];
	export let readonly = false;
	export let load: () => Promise<void> = async () => console.debug();
	export let showLoading = true;
	export let createdAtFormat: 'auto' | 'time' = 'auto';
	export let full = false;
	export let canTransition = true;

	let loading = false;
	let innerHeight: number;
	let scrollY = writable(0);

	onMount(() => {
		console.log('Timeline.onMount');
		scrollY.subscribe(async (y) => {
			const maxHeight = document.documentElement.scrollHeight;
			const scrollRate = Math.floor((100 * (y + innerHeight)) / maxHeight);
			console.debug('[y]', y, innerHeight, maxHeight, scrollRate);

			if (scrollRate > 80 && !loading) {
				console.log('Load more timeline');
				loading = true;
				await load();
				console.log('Timeline loaded');
				loading = false;
			}
		});
	});

	const getTargetETag = (tags: string[][]) => {
		const [, refEventId] = tags.findLast(
			([tagName, tagContent]) =>
				(tagName === 'e' || tagName === 'q') && tagContent !== undefined
		) ?? ['', ''];
		return refEventId;
	};

	const viewDetail = async (clickEvent: MouseEvent, nostrEvent: Event) => {
		let target: HTMLElement | null = clickEvent.target as HTMLElement;
		if (target.closest('.svelteui-Menu-root') !== null || emojiPickerOpen) {
			return;
		}
		if (target) {
			while (target && !target.classList.contains('timeline')) {
				if (
					target.classList.contains('emoji-picker') ||
					target.classList.contains('develop')
				) {
					return;
				}
				const tagName = target.tagName.toLocaleLowerCase();
				if (
					tagName === 'a' ||
					tagName === 'button' ||
					tagName === 'video' ||
					tagName === 'audio' ||
					tagName === 'dialog'
				) {
					return;
				}
				if (tagName === 'p' && String(document.getSelection()).length) {
					return;
				}
				if (tagName === 'blockquote') {
					const refEventId = getTargetETag(nostrEvent.tags);
					if (!refEventId) {
						return;
					}
					const noteId = nip19.neventEncode({ id: refEventId });
					await goto(`/${noteId}`);
					return;
				}
				target = target.parentElement;
			}
		}
		if (canTransition) {
			if (nostrEvent.kind === 40 && $channelIdStore === undefined) {
				await goto(`/channels/${nip19.neventEncode({ id: nostrEvent.id })}`);
				return;
			}
			if (
				(nostrEvent.kind === 41 || nostrEvent.kind === 42) &&
				$channelIdStore === undefined
			) {
				const channelId = findChannelId(nostrEvent.tags);
				if (channelId !== undefined) {
					await goto(`/channels/${nip19.neventEncode({ id: channelId })}`);
					return;
				}
			}
			const eventId = [6, 7, 9735].includes(nostrEvent.kind)
				? getTargetETag(nostrEvent.tags)
				: nostrEvent.id;
			const encodedId = nip19.neventEncode({ id: eventId });
			await goto(`/${encodedId}`);
		}
	};
</script>

<svelte:window bind:innerHeight bind:scrollY={$scrollY} />

<section class="card">
	<VirtualScroll data={items} key="id" let:data pageMode={true} keeps={50}>
		{#if !isMuteEvent(data.event)}
			<!-- svelte-ignore a11y-no-static-element-interactions -->
			<div
				class={canTransition ? 'canTransition-post' : ''}
				class:related={$author?.isNotified(data.event)}
				on:mouseup={(e) => viewDetail(e, data.event)}
			>
				<EventComponent item={data} {readonly} {createdAtFormat} {full} />
			</div>
		{/if}
	</VirtualScroll>
</section>

{#if showLoading}
	<div class="loading"><Loading /></div>
{/if}

<style>
	section {
		margin: 0;
		padding: 0;
	}

	section div {
		border-bottom: var(--default-border);

		animation-name: add;
		animation-duration: 0.8s;

		overflow-x: hidden;
		text-overflow: ellipsis;
	}

	.canTransition-post {
		cursor: pointer;
	}

	.canTransition-post:hover {
		background: var(--accent-surface-low);
	}

	:global(blockquote) {
		cursor: pointer;
	}

	:global(.canTransition-post blockquote:hover) {
		background: var(--accent-surface-high);
	}

	:global(blockquote:hover) {
		background: var(--accent-surface-low);
	}

	.related {
		border-left: 2px solid lightcoral;
	}

	.loading {
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
