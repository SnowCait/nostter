<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { EventItem } from '$lib/Items';
	import { deletedEventIdsByPubkey } from '$lib/author/Delete';
	import { author, isMuteEvent } from '$lib/stores/Author';
	import Loading from './Loading.svelte';
	import EventComponent from './items/EventComponent.svelte';
	import type { NewTimeline } from '$lib/timelines/Timeline';
	import { emojiPickerOpen } from './EmojiPicker.svelte';
	import type { Event } from 'nostr-typedef';
	import { channelIdStore } from '$lib/Channel';
	import { goto } from '$app/navigation';
	import { nip19 } from 'nostr-tools';
	import { getSeenOnRelays } from '$lib/timelines/MainTimeline';
	import { findChannelId } from '$lib/EventHelper';
	import IconChevronsUp from '@tabler/icons-svelte/icons/chevrons-up';
	import { sleep } from '$lib/Helper';
	import { HomeTimeline } from '$lib/timelines/HomeTimeline';
	import { excludeKinds } from '$lib/TimelineFilter';
	import { preferencesStore } from '$lib/Preferences';
	import { followeesOfFollowees } from '$lib/author/MuteAutomatically';

	export let timeline: NewTimeline;
	export let readonly = false;
	export let showLoading = true;
	export let createdAtFormat: 'auto' | 'time' = 'auto';
	export let full = false;
	export let canTransition = true;

	let items: EventItem[] = [];
	let innerHeight: number;
	let scrollY = 0;
	let isTop = true;
	let latest = true;
	let oldest = false;

	$: if (scrollY === 0 && !isTop) {
		isTop = true;
		timeline.setIsTop(isTop);
		if (timeline.autoUpdate && !latest) {
			newer();
		}
	}

	$: if (scrollY > 0 && isTop) {
		isTop = false;
		timeline.setIsTop(isTop);
	}

	$: if (
		scrollY > 0 &&
		scrollY + window.innerHeight * 1.2 >= document.documentElement.scrollHeight &&
		!timeline.loading
	) {
		older();
	}

	$: visibleItems = items.filter(
		(item) =>
			!isMuteEvent(item.event) &&
			!$deletedEventIdsByPubkey.get(item.event.pubkey)?.has(item.event.id) &&
			// TODO: Not to depend on HomeTimeline in Svelte 5
			(!(timeline instanceof HomeTimeline) ||
				(!$excludeKinds.includes(item.event.kind) &&
					(!$preferencesStore.muteAutomatically ||
						$followeesOfFollowees.has(item.event.pubkey))))
	);

	async function newer() {
		const id = visibleItems.at(0)?.id;
		timeline.newer();
		if (id === undefined) {
			return;
		}
		const latestElement = document.getElementById(id);
		if (latestElement === null) {
			return;
		}
		const before = latestElement.getBoundingClientRect();
		await tick();
		const after = latestElement.getBoundingClientRect();
		window.scrollTo({
			top: scrollY + after.top - before.top
		});
	}

	async function older(): Promise<void> {
		const id = visibleItems.at(-1)?.id;
		timeline.reduce();
		if (id === undefined) {
			return;
		}
		const oldestElement = document.getElementById(id);
		if (oldestElement === null) {
			return;
		}
		const before = oldestElement.getBoundingClientRect();
		await tick();
		const after = oldestElement.getBoundingClientRect();
		window.scrollTo({
			top: scrollY + after.top - before.top
		});
		timeline.older();
	}

	//#region Scroll to top

	async function scrollToTop(): Promise<void> {
		timeline.scrollToTop();
		await tick();
		window.scrollTo({
			top: 0,
			behavior: 'smooth'
		});
		// The reflection is not complete immediately after the tick
		await sleep(500);
		window.scrollTo({
			top: 0,
			behavior: 'smooth'
		});
	}

	//#endregion

	const getTargetETag = (tags: string[][]) => {
		const [, refEventId] = tags.findLast(
			([tagName, tagContent]) =>
				(tagName === 'e' || tagName === 'q') && tagContent !== undefined
		) ?? ['', ''];
		return refEventId;
	};

	const viewDetail = async (clickEvent: MouseEvent, nostrEvent: Event) => {
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

	onMount(() => {
		const unsubscribeEvents = timeline.events.subscribe(($events) => {
			items = $events.map((event) => new EventItem(event));
		});

		const unsubscribeLatest = timeline.latest.subscribe(($latest) => {
			latest = $latest;
		});

		const unsubscribeOldest = timeline.oldest.subscribe(($oldest) => {
			oldest = $oldest;
		});

		return () => {
			unsubscribeEvents();
			unsubscribeLatest();
			unsubscribeOldest();
		};
	});
</script>

<svelte:window bind:innerHeight bind:scrollY />

{#if !timeline.autoUpdate && !latest}
	<button on:click={newer} class="new">{$_('timeline.update')}</button>
{/if}

<section class="card">
	{#if scrollY > 0}
		<div class="scroll-to-top">
			<button on:click={scrollToTop} class="scroll-to-top">
				<IconChevronsUp size="24" />
			</button>
		</div>
	{/if}

	{#each visibleItems as item (item.id)}
		<!-- svelte-ignore a11y-no-static-element-interactions -->
		<div
			id={item.id}
			class={canTransition ? 'canTransition-post' : ''}
			class:related={$author?.isNotified(item.event)}
			on:mouseup={(e) => viewDetail(e, item.event)}
		>
			<EventComponent {item} {readonly} {createdAtFormat} {full} />
		</div>
	{/each}
</section>

{#if showLoading && !oldest}
	<div class="loading"><Loading /></div>
{/if}

<style>
	div.scroll-to-top {
		position: absolute;
		left: 50%;
	}

	button.new {
		width: 100%;
		border: var(--default-border);
		border-bottom: none;
		border-radius: var(--radius) var(--radius) 0 0;
		background: var(--accent-foreground);
		color: var(--secondary-accent);
	}

	button.scroll-to-top {
		position: fixed;
		top: 1.5rem;
		transform: translateX(-50%);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
		background: var(--accent-foreground);
		color: var(--secondary-accent);
		border: var(--default-border);
		z-index: 5;
	}

	button.scroll-to-top:hover {
		opacity: 1;
	}

	section {
		margin: 0;
		padding: 0;
		border-radius: 0;
		border-bottom: none;
		position: relative;
		overflow: visible;
	}

	section div:not(.scroll-to-top) {
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
