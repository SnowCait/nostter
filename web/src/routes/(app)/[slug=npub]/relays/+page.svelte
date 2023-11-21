<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { error } from '@sveltejs/kit';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/stores';
	import { appName } from '$lib/Constants';
	import { User as UserDecoder } from '$lib/User';
	import { Api } from '$lib/Api';
	import { pubkey as authorPubkey, readRelays, writeRelays } from '../../../../stores/Author';
	import { debugMode } from '../../../../stores/Preference';
	import { pool } from '../../../../stores/Pool';
	import { Kind } from 'nostr-tools';
	import Relay from './Relay.svelte';
	import { filterRelayTags, parseRelayJson } from '$lib/EventHelper';
	import { Contacts } from '$lib/Contacts';
	import type { User } from '../../../types';
	import IconPencil from '@tabler/icons-svelte/dist/svelte/icons/IconPencil.svelte';
	import IconDeviceFloppy from '@tabler/icons-svelte/dist/svelte/icons/IconDeviceFloppy.svelte';
	import Loading from '$lib/components/Loading.svelte';

	let pubkey: string;
	let relays: { url: string; read: boolean; write: boolean }[] = [];
	let user: User | undefined;
	let editable = false;
	let addingRelay = '';
	let saveToKind3 = false;

	afterNavigate(async () => {
		console.log('[relays page]', $page.params.slug);
		const data = await UserDecoder.decode($page.params.slug);

		if (data.pubkey === undefined) {
			throw error(404);
		}

		pubkey = data.pubkey;

		const api = new Api(
			$pool,
			Array.from(
				new Set([
					...data.relays,
					...(pubkey === $authorPubkey ? $writeRelays : $readRelays)
				])
			)
		);

		api.fetchUserEvent(pubkey).then((userEvent) => {
			user = userEvent?.user;
		});

		const events = await api.fetchRelayEvents(pubkey);
		console.log('[relay events]', events);
		const kind10002 = events.get(Kind.RelayList);
		const kind3 = events.get(Kind.Contacts);
		if (kind10002 !== undefined) {
			relays = filterRelayTags(kind10002.tags).map(([, relay, permission]) => {
				return {
					url: relay,
					read: permission === undefined || permission === 'read',
					write: permission === undefined || permission === 'write'
				};
			});
		} else if (kind3 !== undefined && kind3.content !== '') {
			relays = [...parseRelayJson(kind3.content)].map(([relay, permission]) => {
				return { url: relay, ...permission };
			});
		} else {
			console.warn('[relay events not found]');
		}
	});

	function add() {
		console.log('[add relay]', addingRelay);
		try {
			const relay = new URL(addingRelay).href;
			relays.push({ url: relay, read: true, write: true });
			relays = relays;
			addingRelay = '';
		} catch (error) {
			console.log('[add relay error]', addingRelay, error);
			alert(`Failed to add ${addingRelay}.`);
		}
	}

	function remove(relay: string) {
		console.log('[remove relay]', relay);
		relays = relays.filter(({ url }) => url !== relay);
	}

	async function save() {
		console.log('[save relays]', relays);

		const newWriteRelays = relays.filter(({ write }) => write).map(({ url }) => url);

		try {
			// kind 10002
			const api = new Api($pool, newWriteRelays);
			await api.signAndPublish(
				Kind.RelayList,
				'',
				relays
					.map(({ url, read, write }) => {
						if (read && write) {
							return ['r', url];
						} else if (read) {
							return ['r', url, 'read'];
						} else if (write) {
							return ['r', url, 'write'];
						} else {
							return [];
						}
					})
					.filter((x) => x.length > 0)
			);

			if (saveToKind3) {
				const contacts = new Contacts($authorPubkey, $pool, $writeRelays);
				await contacts.updateRelays(
					new Map(relays.map(({ url, read, write }) => [url, { read, write }]))
				);
			}

			// Completed
			editable = false;
		} catch (error) {
			console.error('[save relays failed]');
			alert('Failed to save relays.');
		}
	}
</script>

<svelte:head>
	{#if user !== undefined}
		<title>{appName} - {user.display_name} (@{user.name}) {$_('pages.relays')}</title>
	{:else}
		<title>{appName} {$_('pages.relays')}</title>
	{/if}
</svelte:head>

<h1>
	{#if user !== undefined}
		<span class="display-name">{user.display_name ?? user.name}</span>
		<span class="name">(@{user.name ?? user.display_name})</span>
	{/if}
	<span>{$_('pages.relays')}</span>
</h1>

<form on:submit|preventDefault={save}>
	<ul>
		<li class="header">
			<div class="relay">Relay</div>
			<div class="checkbox read">Read</div>
			<div class="checkbox write">Write</div>
			{#if editable}
				<div class="remove">Remove</div>
			{/if}
		</li>
		{#each relays as relay}
			<li>
				<Relay {relay} readonly={!editable} on:remove={() => remove(relay.url)} />
			</li>
		{:else}
			<div class="loading">
				<Loading />
			</div>
		{/each}
	</ul>

	{#if pubkey === $authorPubkey}
		{#if editable}
			<div>
				<input
					type="url"
					bind:value={addingRelay}
					on:keyup|stopPropagation={console.debug}
				/>
				<button on:click|preventDefault={add}>Add</button>
			</div>
		{/if}
		<div class="edit-mode">
			{#if editable}
				<label>
					<IconDeviceFloppy />
					<input type="submit" value="Save" />
				</label>
				{#if $debugMode}
					<div>
						<label>
							<input type="checkbox" bind:value={saveToKind3} />
							<span>Write to kind 3 also (usually to kind 10002 only)</span>
						</label>
					</div>
				{/if}
			{:else}
				<label>
					<IconPencil />
					<button class="edit" on:click|preventDefault={() => (editable = true)}>
						<span>Edit</span>
					</button>
				</label>
			{/if}
		</div>
	{/if}
</form>

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

	.remove {
		width: 4rem;
	}

	.loading {
		width: 24px;
		margin: 0 auto;
	}

	.edit-mode {
		margin-top: 1rem;
		margin-bottom: 2rem;
	}

	button.edit,
	input[type='submit'] {
		background-color: transparent;
		border: none;
		cursor: pointer;
		outline: none;
		padding: 0;
		width: inherit;
		height: inherit;

		font-size: 1.2rem;
		color: var(--accent-gray);
	}
</style>
