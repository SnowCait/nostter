<script lang="ts">
	import { error } from '@sveltejs/kit';
	import type { Event } from 'nostr-tools';
	import { createRxOneshotReq, latest, uniq } from 'rx-nostr';
	import { appName } from '$lib/Constants';
	import { referencesReqEmit, rxNostr } from '$lib/timelines/MainTimeline';
	import type { PageData } from './$types';
	import Content from '../content/Content.svelte';
	import Loading from '$lib/components/Loading.svelte';

	export let data: PageData;

	let event: Event | undefined;

	$: title = event?.tags.find(([t]) => t === 'title')?.at(1);
	$: summary = event?.tags.find(([t]) => t === 'summary')?.at(1) ?? '';

	$: {
		const promises = data.relays.map((relay) =>
			rxNostr.addRelay({ url: relay, write: false, read: true })
		);
		Promise.allSettled(promises).then(() => {
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
				.pipe(uniq(), latest())
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
						throw error(404);
					}
				});
		});
	}

	$: if (event !== undefined) {
		console.log('[references req]', event);
		referencesReqEmit(event);
	}
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
	</header>

	<section class="card">
		<Content content={event.content} tags={event.tags} />
	</section>
{/if}
