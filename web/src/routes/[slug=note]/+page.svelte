<script lang="ts">
	import type { Event } from 'nostr-typedef';
	import { createRxOneshotReq, filterKind, uniq, type LazyFilter } from 'rx-nostr';
	import { tap, merge } from 'rxjs';
	import { rxNostr, referencesReqEmit } from '$lib/timelines/MainTimeline';
	import { cachedEvents, metadataStore } from '$lib/cache/Events';
	import type { PageData } from './$types';
	import { author, readRelays } from '../../stores/Author';
	import { pool } from '../../stores/Pool';
	import TimelineView from '../TimelineView.svelte';
	import { Api } from '$lib/Api';
	import { referTags } from '$lib/EventHelper';
	import { EventItem, Metadata } from '$lib/Items';
	import ProfileIconList from './ProfileIconList.svelte';
	import { chronologicalItem } from '$lib/Constants';
	import { tick } from 'svelte';
	import MuteButton from '../action/MuteButton.svelte';
	import CustomEmoji from '../content/CustomEmoji.svelte';
	import IconRepeat from '@tabler/icons-svelte/dist/svelte/icons/IconRepeat.svelte';
	import IconHeart from '@tabler/icons-svelte/dist/svelte/icons/IconHeart.svelte';
	import IconBolt from '@tabler/icons-svelte/dist/svelte/icons/IconBolt.svelte';

	export let data: PageData;

	let focusedElement: HTMLDivElement | undefined;

	let item: EventItem | undefined;
	let items: EventItem[] = [];
	let eventId: string | undefined;
	let rootId: string | undefined;
	let relays: string[] = [];

	$: metadata = item !== undefined ? $metadataStore.get(item.event.pubkey) : undefined;

	let replyToEventItems: EventItem[] = [];
	let repliedToEventItems: EventItem[] = [];
	let repostEventItems: EventItem[] = [];
	let reactionEventItems: EventItem[] = [];
	let zapEventItems: EventItem[] = [];

	let customEmojiShortcode = new Map<string, string>();

	$: repostMetadataList =
		repostEventItems
			.map((x) => $metadataStore.get(x.event.pubkey))
			.filter((x): x is Metadata => x !== undefined);

	$: reactionMetadataMap = reactionEventItems.reduce((map, item) => {
		let content = item.event.content;
		if (item.event.content.startsWith(':')) {
			const emojiTag = item.event.tags
				.find(([tagName, shortcode, url]) => tagName === 'emoji' && `:${shortcode}:` === content && url !== undefined && url !== '');
			if (emojiTag !== undefined) {
				const [, shortcode, url] = emojiTag;
				try {
					new URL(url);
					content = url;
					if (!customEmojiShortcode.has(url)) {
						customEmojiShortcode.set(url, shortcode)
					}
				} catch (error) {
					console.error('[custom emoji invalid]', item);
				}
			}
		}
		const items = map.get(content);
		if (items !== undefined) {
			items.push(item);
		} else {
			map.set(content, [item]);
		}
		return map;
	}, new Map<string, EventItem[]>());

	$: zapMetadataList =
		zapEventItems
			.map((x) => $metadataStore.get(x.event.pubkey))
			.filter((x): x is Metadata => x !== undefined);

	$: if (eventId !== data.eventId) {
		eventId = data.eventId;
		console.log('[thread event id]', eventId);

		clear();

		const event = cachedEvents.get(eventId);
		const filters: LazyFilter[] = [
			{
				'#e': [eventId]
			}
		];
		if (event !== undefined) {
			item = new EventItem(event);
		} else {
			filters.push({
				ids: [eventId]
			});
		}
		console.log('[thread REQ]', filters)
		const eventReq = createRxOneshotReq({filters});
		const observable = rxNostr.use(eventReq).pipe(uniq(), tap(({event}) => referencesReqEmit(event)));

		// Replies
		merge(observable.pipe(filterKind(1)), observable.pipe(filterKind(42))).subscribe(packet => {
			console.log('[thread kind 1]', packet);
			const eventItem = new EventItem(packet.event);
			if (packet.event.id === eventId) {
				item = eventItem;
			} else {
				if (repliedToEventItems.some(x => x.event.id === eventItem.event.id)) {
					console.warn('[thread duplicate event]', packet);
					return;
				}
				repliedToEventItems.push(eventItem);
				repliedToEventItems.sort(chronologicalItem);
				repliedToEventItems = repliedToEventItems;
			}
		});

		// Repost
		observable.pipe(filterKind(6)).subscribe(packet => {
			console.log('[thread kind 6]', packet);
			const eventItem = new EventItem(packet.event);
			repostEventItems.sort(chronologicalItem);
			repostEventItems.push(eventItem);
			repostEventItems = repostEventItems;
		});

		// Reaction
		observable.pipe(filterKind(7)).subscribe(packet => {
			console.log('[thread kind 7]', packet);
			const eventItem = new EventItem(packet.event);
			reactionEventItems.sort(chronologicalItem);
			reactionEventItems.push(eventItem);
			reactionEventItems = reactionEventItems;
		});

		// Zap
		observable.pipe(filterKind(9735)).subscribe(packet => {
			console.log('[thread kind 9735]', packet);

			let event: Event | undefined;
			const description = packet.event.tags
				.find(([tagName, tagContent]) => tagName === 'description' && tagContent !== undefined)
				?.at(1);
			if (description !== undefined) {
				console.log('[thread kind 9734]', description);
				try {
					event = JSON.parse(description) as Event;
					referencesReqEmit(event, true);
				} catch (error) {
					console.log('[zap description parse error]', description);
				}
			}

			if (event === undefined) {
				return;
			}

			const eventItem = new EventItem(event);
			zapEventItems.sort(chronologicalItem);
			zapEventItems.push(eventItem);
			zapEventItems = zapEventItems;
		});
	}

	$: if (item !== undefined) {
		console.log('[thread item]', item);

		const { root, reply } = referTags(item.event);
		rootId = root?.at(1);
		let replyId = reply?.at(1);
		console.log('[thread root, reply]', rootId, replyId);

		fetchReplies(replyId);
	}

	async function fetchReplies(originalReplyId: string | undefined): Promise<void> {
		const api = new Api($pool, [...new Set([...$readRelays, ...relays])]);

		let replyId = originalReplyId;
		let i = 0;
		while (replyId !== undefined) {
			const replyToEvent = await api.fetchEventItemById(replyId);
			if (replyToEvent !== undefined) {
				replyToEventItems.unshift(replyToEvent);
				replyToEventItems = replyToEventItems;
				replyId = referTags(replyToEvent.event).reply?.at(1);
			}
			i++;
			if (i > 20) {
				break;
			}
		}

		if (rootId !== undefined && !replyToEventItems.some((x) => x.event.id === rootId) && i <= 20) {
			const rootEvent = await api.fetchEventItemById(rootId);
			if (rootEvent !== undefined) {
				replyToEventItems.unshift(rootEvent);
				replyToEventItems = replyToEventItems;
			}
		}

		await tick();
		focusedElement?.scrollIntoView();
	}

	function clear() {
		items = [];
		replyToEventItems = [];
		repliedToEventItems = [];
		repostEventItems = [];
		reactionEventItems = [];
		zapEventItems = [];
		customEmojiShortcode = new Map<string, string>();
	}
</script>

<svelte:head>
	<title>nostter - thread</title>
</svelte:head>

<h1>Thread</h1>

<TimelineView
	items={replyToEventItems}
	readonly={false}
	load={async () => console.debug()}
	showLoading={false}
/>

<div bind:this={focusedElement}>
	<!-- TODO: Replace to EventComponent (Using TimelineView for CSS now) -->
	<TimelineView
		items={item !== undefined ? [item] : []}
		readonly={false}
		load={async () => console.debug()}
		showLoading={false}
		full={true}
		canTransition={false}
	/>
</div>

<section class="repost counter card">
	<span class="icon"><IconRepeat /></span>
	<span class="count">{repostEventItems.length}</span>
	<ProfileIconList metadataList={repostMetadataList} />
</section>
{#each [...reactionMetadataMap] as [content, metadataList]}
	<section class="reaction counter card">
		<span class="icon" class:heart={content === '+'}>
			{#if content === '+'}
				<IconHeart />
			{:else if content.startsWith('https')}
				<CustomEmoji url={content} text={customEmojiShortcode.get(content)} />
			{:else}
				<span>{content}</span>
			{/if}
		</span>
		<span class="count">{metadataList.length}</span>
		<ProfileIconList metadataList={metadataList.map(item => $metadataStore.get(item.event.pubkey))} />
	</section>
{:else}
	<section class="reaction counter card">
		<span class="icon heart">
			<IconHeart />
		</span>
		<span class="count">0</span>
		<ProfileIconList metadataList={items.map(item => $metadataStore.get(item.event.pubkey))} />
	</section>
{/each}
<section class="zap counter card">
	<span class="icon"><IconBolt /></span>
	{#if zapMetadataList.length === 0}
		<span class="count">-</span>
	{/if}
	<ProfileIconList metadataList={zapMetadataList} />
</section>
{#if $author !== undefined && item !== undefined}
	<div class="mute">
		<MuteButton tagName="e" tagContent={rootId === undefined ? item.event.id : rootId} />
		<span>Mute this thread</span>
	</div>
	<div class="mute">
		<MuteButton tagName="p" tagContent={item.event.pubkey} />
		<span>Mute @{metadata?.content?.name}</span>
	</div>
{/if}

<TimelineView
	items={repliedToEventItems}
	readonly={false}
	load={async () => console.debug()}
	showLoading={false}
/>

<style>
	section {
		margin: 0.5rem auto;
		padding: 6px;
	}

	.counter {
		display: flex;
		align-items: center;
	}

	.icon {
		margin-right: 0.5rem;
		height: 24px;
	}

	.count {
		margin-right: 0.5rem;
	}

	.repost .icon {
		color: var(--green);
	}

	.heart {
		color: var(--red);
	}

	.zap .icon {
		color: var(--yellow);
	}

	.mute {
		margin-top: 16px;
		display: flex;
		flex-direction: row;
	}

	.mute span {
		margin-left: 0.5rem;
	}
</style>
