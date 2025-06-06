<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { createRxBackwardReq, latestEach } from 'rx-nostr';
	import { Subscription, filter } from 'rxjs';
	import type { Event } from 'nostr-typedef';
	import { nip19 } from 'nostr-tools';
	import { afterNavigate, beforeNavigate } from '$app/navigation';
	import { metadataStore } from '$lib/cache/Events';
	import { metadataReqEmit, rxNostr, tie } from '$lib/timelines/MainTimeline';
	import { appName, reverseChronological } from '$lib/Constants';
	import { isDecodable } from '$lib/Encryption';
	import { findIdentifier } from '$lib/EventHelper';
	import { getListTitle } from '$lib/List';
	import type { LayoutData } from '../$types';
	import { pubkey } from '$lib/stores/Author';
	import Loading from '$lib/components/Loading.svelte';

	export let data: LayoutData;

	let listEvents = new Map<string, Event>();
	let loading = true;
	let subscription: Subscription | undefined;

	$: metadata = $metadataStore.get(data.pubkey);
	$: title =
		(metadata === undefined ? '' : `${metadata.displayName}${$_('lists.particle')}`) +
		$_('lists.title');

	afterNavigate(() => {
		console.log('[lists page]', data.pubkey);
		listEvents.clear();
		listEvents = listEvents;
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

					// For legacy clients
					if (
						!event.tags.some(
							([tagName, pubkey]) => tagName === 'p' && pubkey !== undefined
						) &&
						!(await isDecodable(event.pubkey, event.content))
					) {
						return;
					}

					const identifier = findIdentifier(event.tags) ?? '';
					const last = listEvents.get(identifier);
					if (last === undefined || last.created_at < event.created_at) {
						listEvents.set(identifier, event);
						listEvents = listEvents;
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

<h1>{title}</h1>

<ul>
	{#each [...listEvents].map(([, event]) => event).sort(reverseChronological) as event}
		<li class="card">
			<a
				href="/{nip19.npubEncode(data.pubkey)}/lists/{nip19.naddrEncode({
					kind: event.kind,
					pubkey: event.pubkey,
					identifier: findIdentifier(event.tags) ?? ''
				})}"
			>
				{getListTitle(event.tags)}
			</a>
		</li>
	{:else}
		{#if loading}
			<Loading />
		{:else}
			<p class="card">{$_('lists.none')}</p>
		{/if}
	{/each}
</ul>
