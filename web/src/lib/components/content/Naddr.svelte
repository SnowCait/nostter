<script lang="ts">
	import { onMount } from 'svelte';
	import { nip19, type Event, kinds as Kind } from 'nostr-tools';
	import LongFormContent from './LongFormContent.svelte';
	import List from '$lib/components/items/List.svelte';
	import { fetchLastEvent } from '$lib/RxNostrHelper';
	import { findIdentifier } from '$lib/EventHelper';
	import { getSeenOnRelays } from '$lib/timelines/MainTimeline';

	export let naddr: string;

	let pointer: nip19.AddressPointer;
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
		event = await fetchLastEvent(
			{
				kinds: [kind],
				authors: [pubkey],
				'#d': [identifier]
			},
			{ defaultReadRelays: true, relays }
		);
		console.log('[event]', event);
	});
</script>

{#if event === undefined}
	<a href="/{naddr}">{naddr.substring(0, 'naddr1'.length + 7)}</a>
{:else if event.kind == Kind.LongFormArticle}
	<a
		href="/{nip19.naddrEncode({
			kind: event.kind,
			pubkey: event.pubkey,
			identifier: findIdentifier(event.tags) ?? '',
			relays: getSeenOnRelays(event.id)
		})}"
	>
		<blockquote>
			<LongFormContent {event} />
		</blockquote>
	</a>
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
	a:has(blockquote) {
		text-decoration: none;
	}
</style>
