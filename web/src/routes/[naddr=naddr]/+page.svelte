<script lang="ts">
	import { page } from '$app/stores';
	import { error } from '@sveltejs/kit';
	import { nip19, type Event } from 'nostr-tools';
	import type { AddressPointer } from 'nostr-tools/lib/nip19';
	import { pool } from '../../stores/Pool';
	import { Api } from '$lib/Api';
	import { defaultRelays } from '../../stores/DefaultRelays';
	import { onMount } from 'svelte';
	import { Content as ContentParser } from '$lib/Content';
	import Content from '../content/Content.svelte';

	console.time('naddr');

	let pointer: AddressPointer;
	let event: Event | undefined;

	const naddr = $page.params.naddr;

	$: title = event?.tags.find(([t]) => t === 'title')?.at(1);

	try {
		const { data } = nip19.decode(naddr);
		pointer = data as AddressPointer;
		console.log('[naddr]', pointer);
	} catch (e) {
		throw error(404);
	}

	onMount(async () => {
		const { identifier, kind, pubkey, relays } = pointer;
		const api = new Api(
			$pool,
			relays !== undefined && relays.length > 0 ? relays : $defaultRelays
		);
		event = await api.fetchEvent([
			{
				kinds: [kind],
				authors: [pubkey],
				'#d': [identifier]
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
	<h1>Loading...</h1>
{:else}
	<h1>{title}</h1>

	<p>{event.tags.find(([t]) => t === 'summary')?.at(1)}</p>

	<Content {event} />
{/if}
