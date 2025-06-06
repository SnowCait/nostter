<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { error } from '@sveltejs/kit';
	import type { Event } from 'nostr-tools';
	import { createRxOneshotReq, latest, uniq } from 'rx-nostr';
	import { tap } from 'rxjs';
	import { afterNavigate } from '$app/navigation';
	import { appName } from '$lib/Constants';
	import { referencesReqEmit, rxNostr, tie } from '$lib/timelines/MainTimeline';
	import type { PageData } from './$types';
	import Content from '$lib/components/Content.svelte';
	import Loading from '$lib/components/Loading.svelte';
	import ExternalLink from '$lib/components/ExternalLink.svelte';

	export let data: PageData;

	let event: Event | undefined;

	$: title = event?.tags.find(([t]) => t === 'title')?.at(1);
	$: summary = event?.tags.find(([t]) => t === 'summary')?.at(1) ?? '';
	$: link = new URL(`https://nostrapp.link/kind/${data.kind}`);

	afterNavigate(async () => {
		console.log('[naddr page]', data);

		await Promise.allSettled(
			data.relays.map((relay) =>
				rxNostr.addDefaultRelays([{ url: relay, write: false, read: true }])
			)
		);
		console.log('[naddr relays]', rxNostr.getAllRelayStatus());

		const naddrReq = createRxOneshotReq({
			filters: [
				{
					kinds: [data.kind],
					authors: [data.pubkey],
					'#d': [data.identifier]
				}
			]
		});

		rxNostr
			.use(naddrReq)
			.pipe(
				tie,
				uniq(),
				latest(),
				tap(({ event }) => referencesReqEmit(event))
			)
			.subscribe({
				next: (packet) => {
					console.log('[rx-nostr naddr next]', packet);
					event = packet.event;
				},
				complete: () => {
					console.log('[rx-nostr naddr complete]');
				},
				error: (e) => {
					console.error('[rx-nostr naddr error]', e);
					error(404);
				}
			});
	});
</script>

<svelte:head>
	<title>{appName} - {title}</title>
</svelte:head>

{#if event === undefined}
	<Loading />
{:else}
	<header>
		<h1>{title}</h1>
		<p>{summary}</p>
		<div>
			<ExternalLink {link}>
				{$_('actions.open_in_other_apps.button')}
			</ExternalLink>
		</div>
	</header>

	<section class="card">
		<Content content={event.content} tags={event.tags} />
	</section>
{/if}
