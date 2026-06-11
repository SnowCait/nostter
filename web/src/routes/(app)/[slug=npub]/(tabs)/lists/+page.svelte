<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { createRxBackwardReq, latestEach } from 'rx-nostr';
	import { type Subscription, filter } from 'rxjs';
	import type * as Nostr from 'nostr-typedef';
	import { nip19 } from 'nostr-tools';
	import { IconList, IconLock, IconUsers } from '@tabler/icons-svelte-runes';
	import { afterNavigate, beforeNavigate } from '$app/navigation';
	import { metadataStore } from '$lib/cache/Events';
	import { getSeenOnRelays, metadataReqEmit, rxNostr, tie } from '$lib/timelines/MainTimeline';
	import { appName, reverseChronologicalItem } from '$lib/Constants';
	import { filterTags, findIdentifier } from '$lib/EventHelper';
	import { decryptListContent, getListTitle } from '$lib/List';
	import type { LayoutProps } from '../$types';
	import { pubkey } from '$lib/stores/Author';
	import Loading from '$lib/components/Loading.svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { page } from '$app/state';
	import ProfileTabs from '../ProfileTabs.svelte';

	interface ListItem {
		event: Nostr.Event;
		memberCount: number;
		isPrivate: boolean;
	}

	let { data }: LayoutProps = $props();

	let listItems = new SvelteMap<string, ListItem>();
	let loading = $state(true);
	let subscription: Subscription | undefined;

	let slug = $derived(page.params.slug!);
	let metadata = $derived($metadataStore.get(data.pubkey));
	let title = $derived(
		(metadata === undefined ? '' : `${metadata.displayName}${$_('lists.particle')}`) +
			$_('lists.title')
	);

	afterNavigate(() => {
		console.log('[lists page]', data.pubkey);
		listItems.clear();
		loading = true;
		metadataReqEmit([data.pubkey]);

		const req = createRxBackwardReq();
		subscription = rxNostr
			.use(req)
			.pipe(
				tie,
				latestEach(({ event }) => findIdentifier(event.tags) ?? ''),
				filter(({ event }) => {
					// For legacy clients
					if (findIdentifier(event.tags) === 'mute') {
						return false;
					}
					return (
						event.tags.some(
							([tagName, pubkey]) => tagName === 'p' && pubkey !== undefined
						) ||
						(event.pubkey === $pubkey && event.content !== '')
					);
				})
			)
			.subscribe({
				next: async ({ event }) => {
					console.debug('[lists event]', event);

					const [privateTags] =
						event.pubkey === $pubkey && event.content !== ''
							? await decryptListContent(event.pubkey, event.content)
							: [[] as string[][]];

					const pubkeys = new Set([
						...filterTags('p', event.tags),
						...filterTags('p', privateTags)
					]);

					// For legacy clients
					if (pubkeys.size === 0) {
						return;
					}

					const identifier = findIdentifier(event.tags) ?? '';
					const last = listItems.get(identifier);
					if (last === undefined || last.event.created_at < event.created_at) {
						listItems.set(identifier, {
							event,
							memberCount: pubkeys.size,
							isPrivate: privateTags.length > 0
						});
					}
				},
				complete: () => {
					console.debug('[lists complete]');
					loading = false;
				}
			});
		req.emit([{ kinds: [30000], authors: [data.pubkey] }]);
		req.over();
	});

	beforeNavigate(() => {
		subscription?.unsubscribe();
	});
</script>

<svelte:head>
	<title>{appName} - {title}</title>
</svelte:head>

<ProfileTabs tab="lists" {slug} />

<div class="content">
	{#if listItems.size > 0}
		<ul class="clear">
			{#each [...listItems.values()].sort(reverseChronologicalItem) as { event, memberCount, isPrivate } (event.id)}
				<li>
					<a
						class="card"
						href="/{nip19.npubEncode(data.pubkey)}/lists/{nip19.naddrEncode({
							kind: event.kind,
							pubkey: event.pubkey,
							identifier: findIdentifier(event.tags) ?? '',
							relays: getSeenOnRelays(event.id)
						})}"
					>
						<div class="title">
							<IconList size={20} />
							<span class="name">{getListTitle(event.tags)}</span>
							{#if isPrivate}
								<IconLock size={16} />
							{/if}
						</div>
						<div class="members">
							<IconUsers size={16} />
							<span>{memberCount}</span>
						</div>
					</a>
				</li>
			{/each}
		</ul>
	{:else if loading}
		<Loading />
	{:else}
		<p class="card">{$_('lists.none')}</p>
	{/if}
</div>

<style>
	.content {
		min-height: 80vh;
	}

	ul {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin: 1rem 0;
	}

	a.card {
		display: block;
		color: inherit;
		text-decoration: none;
		transition: background-color 0.2s ease;
	}

	a.card:hover {
		background-color: var(--accent-surface-low);
	}

	.title {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		font-weight: 600;
	}

	.title .name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.members {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		margin-top: 0.5rem;
		color: var(--accent-gray);
		font-size: 0.875rem;
	}
</style>
