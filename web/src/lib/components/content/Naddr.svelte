<script lang="ts">
	import { onMount } from 'svelte';
	import { nip19, type Event, Kind } from 'nostr-tools';
	import type { AddressPointer } from 'nostr-tools/lib/nip19';
	import { Api } from '$lib/Api';
	import { readRelays } from '$lib/stores/Author';
	import { pool } from '$lib/stores/Pool';
	import LongFormContent from './LongFormContent.svelte';
	import List from '$lib/components/items/List.svelte';

	export let naddr: string;

	let pointer: AddressPointer;
	let event: Event | undefined;

	try {
		const { type, data } = nip19.decode(naddr);

		if (type !== 'naddr') {
			throw new Error('Logic error');
		}

		pointer = data as nip19.AddressPointer;
		console.log(pointer);
	} catch (e) {
		console.error('[decode failed]', naddr, e);
	}

	onMount(async () => {
		const { identifier, kind, pubkey, relays } = pointer;
		const api = new Api(
			$pool,
			relays !== undefined && relays.length > 0 ? relays : $readRelays
		);
		event = await api.fetchEvent([
			{
				kinds: [kind],
				authors: [pubkey],
				'#d': [identifier]
			}
		]);
		console.log('[event]', event);
	});
</script>

{#if event === undefined}
	<a href="/{naddr}">{naddr.substring(0, 'naddr1'.length + 7)}</a>
{:else if event.kind == Kind.Article}
	<blockquote>
		<LongFormContent {naddr} {event} />
	</blockquote>
{:else if Number(event.kind) === 30000}
	<a href="/{nip19.npubEncode(event.pubkey)}/lists/{naddr}">
		<blockquote>
			<List {event} />
		</blockquote>
	</a>
{:else}
	<a href="/{naddr}">{naddr.substring(0, 'naddr1'.length + 7)}</a>
{/if}

<style>
	a {
		text-decoration: none;
	}
</style>
