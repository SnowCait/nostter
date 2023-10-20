<script lang="ts">
	import { onMount } from 'svelte';
	import { nip19, type Event, Kind } from 'nostr-tools';
	import type { AddressPointer } from 'nostr-tools/lib/nip19';
	import { Api } from '$lib/Api';
	import { defaultRelays } from '$lib/Constants';
	import { pool } from '../../stores/Pool';
	import LongFormContent from './LongFormContent.svelte';

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
			relays !== undefined && relays.length > 0 ? relays : defaultRelays
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

{#if event === undefined || event.kind !== Kind.Article}
	<a href="/{naddr}">{naddr.substring(0, 'naddr1'.length + 7)}</a>
{:else}
	<blockquote>
		<LongFormContent {naddr} {event} />
	</blockquote>
{/if}
