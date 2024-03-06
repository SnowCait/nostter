<script lang="ts">
	import { nip19 } from 'nostr-tools';
	import type { Event } from 'nostr-typedef';
	import { createRxOneshotReq, filterByKind, uniq } from 'rx-nostr';
	import { tap, merge, filter } from 'rxjs';
	import { _ } from 'svelte-i18n';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { authorActionReqEmit } from '$lib/author/Action';
	import { rxNostr, referencesReqEmit } from '$lib/timelines/MainTimeline';
	import { eventItemStore, metadataStore } from '$lib/cache/Events';
	import type { LayoutData } from './$types';
	import { author, readRelays } from '../../../stores/Author';
	import { pool } from '../../../stores/Pool';
	import TimelineView from '../TimelineView.svelte';
	import { Api } from '$lib/Api';
	import { referTags } from '$lib/EventHelper';
	import { EventItem, Metadata, ZapEventItem } from '$lib/Items';
	import ProfileIconList from './ProfileIconList.svelte';
	import { appName, chronologicalItem } from '$lib/Constants';
	import { tick } from 'svelte';
	import MuteButton from '$lib/components/MuteButton.svelte';
	import CustomEmoji from '../content/CustomEmoji.svelte';
	import IconRepeat from '@tabler/icons-svelte/dist/svelte/icons/IconRepeat.svelte';
	import IconHeart from '@tabler/icons-svelte/dist/svelte/icons/IconHeart.svelte';
	import IconBolt from '@tabler/icons-svelte/dist/svelte/icons/IconBolt.svelte';
	import NotFound from '$lib/components/items/NotFound.svelte';
	import DateLink from '$lib/components/DateLink.svelte';
	import EventComponent from '../timeline/EventComponent.svelte';

	export let data: LayoutData;

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
	let zapEventItemsMap = new Map<number | undefined, ZapEventItem[]>();

	let customEmojiShortcode = new Map<string, string>();

	$: repostMetadataList = repostEventItems
		.map((x) => $metadataStore.get(x.event.pubkey))
		.filter((x): x is Metadata => x !== undefined);

	$: reactionMetadataMap = reactionEventItems.reduce((map, item) => {
		let content = item.event.content;
		if (content === '') {
			content = '+';
		} else if (content.startsWith(':')) {
			const emojiTag = item.event.tags.find(
				([tagName, shortcode, url]) =>
					tagName === 'emoji' &&
					`:${shortcode}:` === content &&
					url !== undefined &&
					url !== ''
			);
			if (emojiTag !== undefined) {
				const [, shortcode, url] = emojiTag;
				try {
					new URL(url);
					content = url;
					if (!customEmojiShortcode.has(url)) {
						customEmojiShortcode.set(url, shortcode);
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

	$: if (eventId !== data.eventId && browser) {
		eventId = data.eventId;
		console.log('[thread event id]', eventId);

		clear();

		item = $eventItemStore.get(eventId);

		// Event
		if (item === undefined) {
			const eventReq = createRxOneshotReq({
				filters: [
					{
						ids: [eventId]
					}
				]
			});
			rxNostr
				.use(eventReq)
				.pipe(
					uniq(),
					tap(({ event }) => {
						referencesReqEmit(event);
						authorActionReqEmit(event);
					})
				)
				.subscribe((packet) => {
					console.log('[thread event]', packet);
					item = new EventItem(packet.event);
				});
		}

		// Related Events
		const relatedEventsReq = createRxOneshotReq({
			filters: [
				{
					kinds: [1, 6, 7, 9735],
					'#e': [eventId]
				}
			]
		});
		const observable = rxNostr.use(relatedEventsReq).pipe(
			uniq(),
			tap(({ event }) => {
				referencesReqEmit(event);
				authorActionReqEmit(event);
			})
		);

		// Replies
		merge(observable.pipe(filterByKind(1)), observable.pipe(filterByKind(42))).subscribe(
			(packet) => {
				console.log('[thread kind 1]', packet);
				const eventItem = new EventItem(packet.event);
				if (repliedToEventItems.some((x) => x.event.id === eventItem.event.id)) {
					console.warn('[thread duplicate event]', packet);
					return;
				}
				repliedToEventItems.push(eventItem);
				repliedToEventItems.sort(chronologicalItem);
				repliedToEventItems = repliedToEventItems;
			}
		);

		// Repost
		observable.pipe(filterByKind(6)).subscribe((packet) => {
			console.log('[thread kind 6]', packet);
			const eventItem = new EventItem(packet.event);
			repostEventItems.sort(chronologicalItem);
			repostEventItems.push(eventItem);
			repostEventItems = repostEventItems;
		});

		// Reaction
		observable
			.pipe(
				filterByKind(7),
				filter(
					({ event }) =>
						event.tags.findLast(([tagName]) => tagName === 'e')?.at(1) === eventId
				)
			)
			.subscribe((packet) => {
				console.log('[thread kind 7]', packet);
				const eventItem = new EventItem(packet.event);
				reactionEventItems.sort(chronologicalItem);
				reactionEventItems.push(eventItem);
				reactionEventItems = reactionEventItems;
			});

		// Zap
		observable.pipe(filterByKind(9735)).subscribe((packet) => {
			console.log('[thread kind 9735]', packet);

			let event: Event | undefined;
			const description = packet.event.tags
				.find(
					([tagName, tagContent]) => tagName === 'description' && tagContent !== undefined
				)
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

			const eventItem = new ZapEventItem(packet.event);
			let eventItems = zapEventItemsMap.get(eventItem.amount) ?? [];
			eventItems.push(eventItem);
			zapEventItemsMap.set(eventItem.amount, eventItems);
			zapEventItemsMap = zapEventItemsMap;
		});
	}

	$: if (item !== undefined && rootId === undefined) {
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
			const replyToEventItem = await api.fetchEventItemById(replyId);
			console.log('[thread reply]', replyToEventItem);
			if (replyToEventItem !== undefined) {
				replyToEventItems.unshift(replyToEventItem);
				replyToEventItems = replyToEventItems;
				const { root, reply } = referTags(replyToEventItem.event);
				replyId = reply?.at(1);
				if (rootId === undefined) {
					rootId = root?.at(1);
				}
			}
			i++;
			if (i > 20) {
				break;
			}
		}

		if (
			rootId !== undefined &&
			!replyToEventItems.some((x) => x.event.id === rootId) &&
			i <= 20
		) {
			const rootEventItem = await api.fetchEventItemById(rootId);
			console.log('[thread root]', rootEventItem);
			if (rootEventItem !== undefined) {
				replyToEventItems.unshift(rootEventItem);
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
		zapEventItemsMap.clear();
		zapEventItemsMap = zapEventItemsMap;
		customEmojiShortcode = new Map<string, string>();
	}
</script>

<svelte:head>
	<title>
		{appName} - {item !== undefined
			? `${metadata?.displayName}: ${item.event.content}`
			: $_('pages.thread')}
	</title>
</svelte:head>

<h1>{$_('pages.thread')}</h1>

<TimelineView items={replyToEventItems} readonly={false} showLoading={false} />

<div bind:this={focusedElement} class="card">
	{#if item === undefined}
		<NotFound />
	{:else}
		<EventComponent {item} readonly={false} full={true} />
	{/if}
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
		<ProfileIconList
			metadataList={metadataList.map((item) => $metadataStore.get(item.event.pubkey))}
		/>
	</section>
{:else}
	<section class="reaction counter card">
		<span class="icon heart">
			<IconHeart />
		</span>
		<span class="count">0</span>
		<ProfileIconList
			metadataList={items.map((item) => $metadataStore.get(item.event.pubkey))}
		/>
	</section>
{/each}
{#each [...zapEventItemsMap].sort( ([amountX], [amountY]) => (amountX === undefined ? -1 : amountY === undefined ? 1 : amountY - amountX) ) as [amount, zapEventItems]}
	<section class="zap counter card">
		<span class="icon"><IconBolt /></span>
		{#if amount !== undefined}
			<span class="amount">{amount.toLocaleString()}</span>
		{/if}
		<ProfileIconList
			metadataList={zapEventItems.map((item) =>
				$metadataStore.get(item.requestEvent?.pubkey ?? item.event.pubkey)
			)}
		/>
	</section>
{:else}
	<section class="zap counter card">
		<span class="icon"><IconBolt /></span>
		<span class="count">-</span>
	</section>
{/each}
<nav class="card">
	{#if item !== undefined}
		<div>
			<DateLink
				slug={nip19.npubEncode(item.event.pubkey)}
				date={new Date(item.event.created_at * 1000)}
			>
				{$_('thread.date')}
			</DateLink>
		</div>
	{/if}
	{#if repostEventItems.length > 0}
		<div>
			<a href="/{$page.params.slug}/reposts/after">{$_('thread.reposts.after.title')}</a>
		</div>
	{/if}
</nav>
{#if $author !== undefined && item !== undefined}
	<nav class="card">
		<div class="mute">
			<MuteButton tagName="e" tagContent={rootId === undefined ? item.event.id : rootId} />
			<span>Mute this thread</span>
		</div>
		<div class="mute">
			<MuteButton tagName="p" tagContent={item.event.pubkey} />
			<span>Mute @{metadata?.content?.name}</span>
		</div>
	</nav>
{/if}

<TimelineView items={repliedToEventItems} readonly={false} showLoading={false} />

<style>
	section {
		margin: 0.5rem auto;
		padding: 6px;
	}

	div.card {
		padding: 0;
	}

	.counter {
		display: flex;
		align-items: center;
	}

	.icon {
		margin-right: 0.5rem;
		height: 24px;
	}

	.count,
	.amount {
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

	nav div + div {
		margin-top: 0.5rem;
	}

	.mute {
		display: flex;
		flex-direction: row;
	}

	.mute span {
		margin-left: 0.5rem;
	}
</style>
