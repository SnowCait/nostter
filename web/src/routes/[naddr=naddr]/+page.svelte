<script lang="ts">
	import { page } from '$app/stores';
	import { error } from '@sveltejs/kit';
	import { nip19, type Event } from 'nostr-tools';
	import type { AddressPointer } from 'nostr-tools/lib/nip19';
	import { pool } from '../../stores/Pool';
	import { Api } from '$lib/Api';
	import { defaultRelays } from '../../stores/DefaultRelays';
	import { onMount } from 'svelte';
	import { Content } from '$lib/Content';
	import ReferenceNip27 from '../content/ReferenceNip27.svelte';
	import Reference from '../content/Reference.svelte';
	import Hashtag from '../content/Hashtag.svelte';
	import Url from '../content/Url.svelte';
	import Text from '../content/Text.svelte';

	console.time('naddr');

	let pointer: AddressPointer;
	let event: Event | undefined;

	const naddr = $page.params.naddr;

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

		const tokens = Content.parse(event.content);
		console.log('[tokens]', tokens);

		console.timeEnd('naddr');
	});
</script>

{#if event === undefined}
	<h1>Loading...</h1>
{:else}
	<h1>{event.tags.find(([t]) => t === 'title')?.at(1)}</h1>

	<p>{event.tags.find(([t]) => t === 'summary')?.at(1)}</p>

	<p class="content">
		{#each Content.parse(event.content, event.tags) as token}
			{#if token.name === 'reference' && token.index === undefined}
				<ReferenceNip27 text={token.text} />
			{:else if token.name === 'reference' && token.index !== undefined && event.tags.at(token.index) !== undefined}
				<Reference text={token.text} tag={event.tags[token.index]} />
			{:else if token.name === 'hashtag'}
				<Hashtag text={token.text} />
			{:else if token.name === 'url'}
				<Url text={token.text} />
			{:else if token.name === 'nip'}
				<Url
					text={token.text}
					url="https://github.com/nostr-protocol/nips/blob/master/{token.text.substring(
						'NIP-'.length
					)}.md"
				/>
			{:else}
				<Text text={token.text} />
			{/if}
		{/each}
	</p>
{/if}
