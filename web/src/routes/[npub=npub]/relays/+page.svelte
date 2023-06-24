<script lang="ts">
	import { error } from '@sveltejs/kit';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/stores';
	import { User as UserDecoder } from '$lib/User';
	import { Api } from '$lib/Api';
	import { readRelays } from '../../../stores/Author';
	import { pool } from '../../../stores/Pool';
	import { Kind } from 'nostr-tools';
	import Relay from './Relay.svelte';
	import { parseRelayJson, relayTagsToMap } from '$lib/EventHelper';
	import type { User } from '../../types';

	let relayMap = new Map<string, { read: boolean; write: boolean }>();
	let user: User | undefined;

	afterNavigate(async () => {
		console.log('[relays page]', $page.params.npub);
		const { pubkey, relays } = await UserDecoder.decode($page.params.npub);

		if (pubkey === undefined) {
			throw error(404);
		}

		const api = new Api($pool, Array.from(new Set([...relays, ...$readRelays])));

		api.fetchUserEvent(pubkey).then((userEvent) => {
			user = userEvent?.user;
		});

		const events = await api.fetchRelayEvents(pubkey);
		console.log('[relay events]', events);
		const kind10002 = events.get(Kind.RelayList);
		if (kind10002 !== undefined) {
			relayMap = relayTagsToMap(kind10002.tags);
		}
		const kind3 = events.get(Kind.Contacts);
		if (
			kind3 !== undefined &&
			(kind10002 === undefined || kind3.created_at > kind10002.created_at)
		) {
			relayMap = parseRelayJson(kind3.content);
		}
	});
</script>

<svelte:head>
	{#if user !== undefined}
		<title>{user.display_name} (@{user.name}) Relays - nostter</title>
	{:else}
		<title>Relays - nostter</title>
	{/if}
</svelte:head>

<h1>
	{#if user !== undefined}
		<span class="display-name">{user.display_name ?? user.name}</span>
		<span class="name">(@{user.name ?? user.display_name})</span>
	{/if}
	<span>Relays</span>
</h1>

<ul>
	<li class="header">
		<div class="relay">Relay</div>
		<div class="checkbox read">Read</div>
		<div class="checkbox write">Write</div>
	</li>
	{#each [...relayMap] as [relay, { read, write }]}
		<li>
			<Relay {relay} {read} {write} readonly={true} />
		</li>
	{/each}
</ul>

<style>
	.name {
		color: gray;
	}

	ul {
		list-style: none;
		padding: 0;
	}

	li:nth-child(even) {
		background-color: rgb(245, 245, 245);
	}

	.header {
		display: flex;
		flex-direction: row;
		padding: 4px;
		font-weight: bold;
	}

	.relay {
		max-width: calc(100% - 8rem);
	}

	.checkbox {
		width: 4rem;
		text-align: center;
	}

	.checkbox.read {
		margin-left: auto;
	}
</style>
