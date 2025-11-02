<script lang="ts">
	import { nip19 } from 'nostr-tools';
	import type { Event } from 'nostr-typedef';
	import { createRxBackwardReq, createRxOneshotReq, filterByKind, uniq } from 'rx-nostr';
	import { tap, merge, filter } from 'rxjs';
	import { _ } from 'svelte-i18n';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { authorActionReqEmit } from '$lib/author/Action';
	import { rxNostr, referencesReqEmit, tie } from '$lib/timelines/MainTimeline';
	import { insertIntoAscendingTimeline } from '$lib/timelines/TimelineHelper';
	import { eventItemStore, metadataStore } from '$lib/cache/Events';
	import type { LayoutData } from './$types';
	import TimelineView from '../TimelineView.svelte';
	import { referTags } from '$lib/EventHelper';
	import { fetchEvent, inThread } from '$lib/Thread';
	import { EventItem, Metadata, ZapEventItem } from '$lib/Items';
	import ProfileIconList from './ProfileIconList.svelte';
	import { appName, chronological, chronologicalItem } from '$lib/Constants';
	import { onDestroy, onMount, tick } from 'svelte';
	import CustomEmoji from '$lib/components/content/CustomEmoji.svelte';
	import IconRepeat from '@tabler/icons-svelte/icons/repeat';
	import IconHeart from '@tabler/icons-svelte/icons/heart';
	import IconBolt from '@tabler/icons-svelte/icons/bolt';
	import NotFound from '$lib/components/items/NotFound.svelte';
	import DateLink from '$lib/components/DateLink.svelte';
	import EventComponent from '$lib/components/items/EventComponent.svelte';
	import BackButton from '$lib/components/BackButton.svelte';
	import { IconHeartBroken } from '@tabler/icons-svelte';

	export let data: LayoutData;

	let focusedElement: HTMLDivElement | undefined;

	let item: EventItem | undefined;
	let items: EventItem[] = [];
	let eventId: string | undefined;
	let rootId: string | undefined;
	let canonicalUrl: string | undefined;

	$: metadata = item !== undefined ? $metadataStore.get(item.event.pubkey) : undefined;

	$: if (!browser && data.event !== undefined) {
		item = new EventItem(data.event);
	}

	$: if (item !== undefined) {
		canonicalUrl = `${$page.url.origin}/${nip19.neventEncode({
			id: item.event.id,
			author: item.event.pubkey
		})}`;
	}

	let replyToEventItems: EventItem[] = [];
	let repliedToEventItems: EventItem[] = [];
	let repliedToEventsMap = new Map<string, Event>();
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
					console.error('[custom emoji invalid]', item, error);
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
					tie,
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
			tie,
			uniq(),
			tap(({ event }) => {
				referencesReqEmit(event);
				authorActionReqEmit(event);
			})
		);

		// Replies
		merge(observable.pipe(filterByKind(1)), observable.pipe(filterByKind(42)))
			.pipe(filter(({ event }) => !repliedToEventItems.some((x) => x.event.id === event.id)))
			.subscribe((packet) => {
				console.debug('[thread kind 1]', packet);
				insertIntoAscendingTimeline(packet.event, repliedToEventItems);
				repliedToEventItems = repliedToEventItems;
			});

		// Repost
		observable.pipe(filterByKind(6)).subscribe((packet) => {
			console.debug('[thread kind 6]', packet);
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
				console.debug('[thread kind 7]', packet);
				const eventItem = new EventItem(packet.event);
				reactionEventItems.sort(chronologicalItem);
				reactionEventItems.push(eventItem);
				reactionEventItems = reactionEventItems;
			});

		// Zap
		observable.pipe(filterByKind(9735)).subscribe((packet) => {
			console.debug('[thread kind 9735]', packet);

			let event: Event | undefined;
			const description = packet.event.tags
				.find(
					([tagName, tagContent]) => tagName === 'description' && tagContent !== undefined
				)
				?.at(1);
			if (description !== undefined) {
				console.debug('[thread kind 9734]', description);
				try {
					event = JSON.parse(description) as Event;
					referencesReqEmit(event, true);
				} catch (error) {
					console.log('[zap description parse error]', description, error);
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

	let id: string | undefined;

	$: if (item !== undefined && item.id !== id && browser) {
		console.debug('[thread item]', item);
		id = item.id;
		const { root, reply } = referTags(item.event);
		rootId = root?.at(1);
		fetchReplies(reply?.at(1));
		fetchThreads(rootId, item.event);
	}

	async function fetchReplies(originalReplyId: string | undefined): Promise<void> {
		let replyId = originalReplyId;
		let i = 0;
		while (replyId !== undefined) {
			const replyToEventItem = await fetchEvent(replyId);
			console.debug('[thread reply]', replyToEventItem);
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
			const rootEventItem = await fetchEvent(rootId);
			console.debug('[thread root]', rootEventItem);
			if (rootEventItem !== undefined) {
				replyToEventItems.unshift(rootEventItem);
				replyToEventItems = replyToEventItems;
			}
		}

		await tick();
		focusedElement?.scrollIntoView();
	}

	function fetchThreads(rootId: string | undefined, original: Event): void {
		if (rootId === undefined) {
			return;
		}

		const req = createRxBackwardReq();
		rxNostr
			.use(req)
			.pipe(tie, uniq())
			.subscribe({
				next: ({ event }) => {
					console.debug('[thread events next]', event.id);
					const { root, reply } = referTags(event);
					if (root?.at(1) === original.id || reply?.at(1) === original.id) {
						if (!repliedToEventItems.some((item) => item.id === event.id)) {
							insertIntoAscendingTimeline(event, repliedToEventItems);
							repliedToEventItems = repliedToEventItems;
						}
					} else {
						repliedToEventsMap.set(event.id, event);
					}
				},
				complete: () => {
					console.debug('[thread events complete]', repliedToEventsMap);
					for (const event of [...repliedToEventsMap]
						.map(([, event]) => event)
						.toSorted(chronological)) {
						const { reply } = referTags(event);
						if (
							repliedToEventItems.some((item) => item.id === reply?.at(1)) &&
							!repliedToEventItems.some((item) => item.id === event.id)
						) {
							insertIntoAscendingTimeline(event, repliedToEventItems);
						}
					}
					repliedToEventItems = repliedToEventItems;
				}
			});
		req.emit([{ kinds: [1], '#e': [rootId, original.id], since: original.created_at }]);
		req.over();
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

	onMount(() => {
		$inThread = true;
	});

	onDestroy(() => {
		$inThread = false;
	});
</script>

<svelte:head>
	<title>
		{appName} - {item !== undefined
			? `${metadata?.displayName}: ${item.event.content}`
			: $_('pages.thread')}
	</title>
	{#if item !== undefined}
		<meta property="og:title" content={item.event.content} />
	{/if}
	{#if canonicalUrl !== undefined}
		<link href={canonicalUrl} rel="canonical" />
	{/if}
</svelte:head>

<div class="back mobile">
	<BackButton />
</div>

<header>
	<div class="back">
		<BackButton />
	</div>
	<h1>{$_('pages.thread')}</h1>
</header>

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
		<span class="icon" class:heart={content === '+' || content === '-'}>
			{#if content === '+'}
				<IconHeart />
			{:else if content === '-'}
				<IconHeartBroken />
			{:else if URL.canParse(content)}
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
	<div>
		<a href="/{$page.params.slug}/quotes">{$_('thread.quotes.title')}</a>
	</div>
</nav>

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
		color: var(--pink);
	}

	.zap .icon {
		color: var(--yellow);
	}

	nav div + div {
		margin-top: 0.5rem;
	}

	a {
		text-decoration: underline;
	}

	header {
		display: flex;
	}

	.mobile {
		display: none;
	}

	.back {
		width: 36px;
		height: 36px;
	}

	.back:not(.mobile) {
		margin: auto 0.5rem;
	}

	@media screen and (max-width: 600px) {
		.mobile {
			display: initial;
		}

		.back:not(.mobile) {
			display: none;
		}

		.back {
			position: fixed;
			top: calc((50px - 36px) / 2);
			left: calc((50px - 36px) / 2);
			z-index: 4;
		}
	}
</style>
