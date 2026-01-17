<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { createRxOneshotReq, now, uniq } from 'rx-nostr';
	import type { Filter } from 'nostr-typedef';
	import { tap, filter } from 'rxjs';
	import { authorActionReqEmit } from '$lib/author/Action';
	import { appName, minTimelineLength } from '$lib/Constants';
	import { EventItem } from '$lib/Items';
	import { metadataStore } from '$lib/cache/Events';
	import type { LayoutData } from '../$types';
	import { pubkey as authorPubkey } from '$lib/stores/Author';
	import TimelineView from '../../TimelineView.svelte';
	import { referencesReqEmit, rxNostr, tie } from '$lib/timelines/MainTimeline';

	interface Props {
		data: LayoutData;
	}

	let { data }: Props = $props();

	let pubkey = $derived(data.pubkey);
	let metadata = $derived($metadataStore.get(pubkey));

	let items: EventItem[] = $state([]);

	async function load() {
		console.log('[npub page timeline load]', data.pubkey);

		let firstLength = items.length;
		let count = 0;
		let until =
			items.length > 0 ? Math.min(...items.map((item) => item.event.created_at)) : now();
		let seconds = 12 * 60 * 60;

		while (items.length - firstLength < minTimelineLength && count < 10) {
			const since = until - seconds;
			console.log(
				'[rx-nostr user media timeline period]',
				new Date(since * 1000),
				new Date(until * 1000)
			);

			const filters: Filter[] = [
				{
					kinds: [1, 42],
					authors: [pubkey],
					until,
					since
				}
			];
			console.log('[rx-nostr user media timeline REQ]', filters, rxNostr.getAllRelayStatus());
			const pastEventsReq = createRxOneshotReq({ filters });
			console.log('[rx-nostr user media timeline req ID]', pastEventsReq);
			await new Promise<void>((resolve, reject) => {
				rxNostr
					.use(pastEventsReq)
					.pipe(
						tie,
						uniq(),
						filter(({ event }) => event.content.includes('https://')), // Media filter
						tap(({ event }) => {
							referencesReqEmit(event);
							authorActionReqEmit(event);
						})
					)
					.subscribe({
						next: async (packet) => {
							console.log('[rx-nostr user media timeline packet]', packet);
							if (
								!(
									since <= packet.event.created_at &&
									packet.event.created_at < until
								)
							) {
								console.warn(
									'[rx-nostr user media timeline out of period]',
									packet,
									since,
									until
								);
								return;
							}
							if (items.some((x) => x.event.id === packet.event.id)) {
								console.warn(
									'[rx-nostr user media timeline duplicate]',
									packet.event
								);
								return;
							}

							if (!(await containsMedia(packet.event.content))) {
								return;
							}

							const item = new EventItem(packet.event);
							const index = items.findIndex(
								(x) => x.event.created_at < item.event.created_at
							);
							if (index < 0) {
								items.push(item);
							} else {
								items.splice(index, 0, item);
							}
							items = items;
						},
						complete: () => {
							console.log(
								'[rx-nostr user media timeline complete]',
								pastEventsReq.rxReqId
							);
							resolve();
						},
						error: (error) => {
							reject(error);
						}
					});
			});

			until -= seconds;
			seconds *= 2;
			count++;
			console.log(
				'[rx-nostr user media timeline loaded]',
				pastEventsReq.rxReqId,
				count,
				until,
				seconds / 3600,
				items.length
			);
		}
	}

	async function containsMedia(content: string): Promise<boolean> {
		const matches = content.matchAll(/https:\/\/\S+/g);
		for (const match of matches) {
			console.log('[media url]', match);
			let response: Response;
			try {
				const url = new URL(match[0]);
				response = await fetch(url, {
					method: 'HEAD'
				});
			} catch (error) {
				console.error('[media error]', match, error);
				continue;
			}
			console.log('[media headers]', response.headers);
			const contentType = response.headers.get('Content-Type');
			if (contentType === null) {
				continue;
			}
			if (
				contentType.startsWith('image/') ||
				contentType.startsWith('video/') ||
				contentType.startsWith('audio/')
			) {
				return true;
			}
		}
		return false;
	}
</script>

<svelte:head>
	{#if metadata !== undefined}
		<title>{appName} - {metadata.displayName} (@{metadata.name})</title>
		<meta property="og:image" content={metadata.picture} />
	{:else}
		<title>{appName} - ghost</title>
	{/if}
</svelte:head>

{#if metadata !== undefined}
	<h1>{metadata?.displayName} {$_('pages.media')}</h1>
{:else}
	<h1>{$_('pages.media')}</h1>
{/if}

<section>
	<TimelineView {items} readonly={!$authorPubkey} {load} />
</section>
