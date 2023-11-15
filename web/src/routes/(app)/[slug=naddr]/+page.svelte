<script lang="ts">
	import { error } from '@sveltejs/kit';
	import type { Event } from 'nostr-tools';
	import { pool } from '../../../stores/Pool';
	import { Api } from '$lib/Api';
	import { defaultRelays } from '$lib/Constants';
	import { onMount } from 'svelte';
	import { Content as ContentParser } from '$lib/Content';
	import { referencesReqEmit } from '$lib/timelines/MainTimeline';
	import type { PageData } from './$types';
	import Content from '../content/Content.svelte';
	import Loading from '../Loading.svelte';

	export let data: PageData;

	console.time('naddr');

	let event: Event | undefined;

	$: title = event?.tags.find(([t]) => t === 'title')?.at(1);

	$: if (event !== undefined) {
		referencesReqEmit(event);
	}

	onMount(async () => {
		const api = new Api($pool, data.relays.length > 0 ? data.relays : defaultRelays);
		event = await api.fetchEvent([
			{
				kinds: [data.kind],
				authors: [data.pubkey],
				'#d': [data.identifier]
			}
		]);
		console.log('[event]', event);

		if (event === undefined) {
			throw error(404);
		}

		const tokens = ContentParser.parse(event.content);
		console.log('[tokens]', tokens);

		console.timeEnd('naddr');
	});
</script>

<svelte:head>
	<title>{title} - nostter</title>
</svelte:head>

{#if event === undefined}
	<Loading />
{:else}
	<header>
		<h1>{title}</h1>
		<p>{event.tags.find(([t]) => t === 'summary')?.at(1) ?? ''}</p>
	</header>

	<section class="card">
		<Content content={event.content} tags={event.tags} />
	</section>
{/if}
