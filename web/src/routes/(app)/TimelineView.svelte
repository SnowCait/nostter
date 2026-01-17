<script lang="ts">
	import { writable } from 'svelte/store';
	import { onMount } from 'svelte';
	import { nip19, type Event } from 'nostr-tools';
	import { VirtualScroll } from 'svelte-virtual-scroll-list';
	import { goto } from '$app/navigation';
	import type { Item } from '$lib/Items';
	import { channelIdStore } from '$lib/Channel';
	import { findChannelId } from '$lib/EventHelper';
	import { deletedEventIdsByPubkey } from '$lib/author/Delete';
	import { author, isMuteEvent } from '$lib/stores/Author';
	import Loading from '$lib/components/Loading.svelte';
	import { emojiPickerOpen } from '$lib/components/EmojiPicker.svelte';
	import EventComponent from '$lib/components/items/EventComponent.svelte';
	import { getSeenOnRelays } from '$lib/timelines/MainTimeline';
	import { MouseButton } from '$lib/DomHelper';
	import { innerHeight } from 'svelte/reactivity/window';

	interface Props {
		items?: Item[];
		readonly?: boolean;
		load?: () => Promise<void>;
		showLoading?: boolean;
		createdAtFormat?: 'auto' | 'time';
		full?: boolean;
		canTransition?: boolean;
	}

	let {
		items = [],
		readonly = false,
		load = async () => console.debug(),
		showLoading = true,
		createdAtFormat = 'auto',
		full = false,
		canTransition = true
	}: Props = $props();

	let loading = false;
	let scrollY = writable(0);

	let visibleItems = $derived(
		items.filter(
			(item) =>
				!isMuteEvent(item.event) &&
				!$deletedEventIdsByPubkey.get(item.event.pubkey)?.has(item.event.id)
		)
	);

	onMount(() => {
		console.log('Timeline.onMount');
		scrollY.subscribe(async (y) => {
			const maxHeight = document.documentElement.scrollHeight;
			const scrollRate = Math.floor((100 * (y + innerHeight.current!)) / maxHeight);

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
		if (clickEvent.button !== MouseButton.Left) {
			return;
		}

		let target: HTMLElement | null = clickEvent.target as HTMLElement;
		if (target.closest('.svelteui-Menu-root') || target.closest('a') || emojiPickerOpen) {
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
				target = target.parentElement;
			}
		}
		if (canTransition) {
			if (nostrEvent.kind === 40 && $channelIdStore === undefined) {
				await goto(
					`/channels/${nip19.neventEncode({
						id: nostrEvent.id,
						relays: getSeenOnRelays(nostrEvent.id),
						author: nostrEvent.pubkey,
						kind: nostrEvent.kind
					})}`
				);
				return;
			}
			if (
				(nostrEvent.kind === 41 || nostrEvent.kind === 42) &&
				$channelIdStore === undefined
			) {
				const channelId = findChannelId(nostrEvent.tags);
				if (channelId !== undefined) {
					await goto(
						`/channels/${nip19.neventEncode({ id: channelId, relays: getSeenOnRelays(channelId) })}`
					);
					return;
				}
			}
			const eventId = [6, 7, 9735].includes(nostrEvent.kind)
				? getTargetETag(nostrEvent.tags)
				: nostrEvent.id;
			const nevent = nip19.neventEncode({ id: eventId, relays: getSeenOnRelays(eventId) });
			await goto(`/${nevent}`);
		}
	};
</script>

<svelte:window bind:scrollY={$scrollY} />

{#if visibleItems.length > 0}
	<section class="card">
		<VirtualScroll data={visibleItems} key="id" let:data pageMode={true} keeps={50}>
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class={canTransition ? 'canTransition-post' : ''}
				class:related={$author?.isNotified(data.event)}
				onmouseup={(e) => viewDetail(e, data.event)}
			>
				<EventComponent item={data} {readonly} {createdAtFormat} {full} />
			</div>
		</VirtualScroll>
	</section>
{/if}

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
