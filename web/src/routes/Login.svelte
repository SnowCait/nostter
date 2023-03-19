<script lang="ts" context="module">
	interface Window {
		// NIP-07
		nostr: any;
	}
	declare var window: Window;
</script>

<script lang="ts">
	import { goto } from '$app/navigation';
	import { Kind, nip19 } from 'nostr-tools';
	import { onMount } from 'svelte';
	import {
		pubkey,
		authorProfile,
		recommendedRelay,
		followees,
		relayUrls,
		rom
	} from '../stores/Author';
	import { defaultRelays } from '../stores/DefaultRelays';
	import { pool } from '../stores/Pool';
	import type { RelayPermission } from './types';

	let login: string | null = null;
	let npub = '';

	onMount(async () => {
		console.log('onMount');

		login = localStorage.getItem('nostter:login');
		console.log('[login]', login);

		if (login === null) {
			return;
		}

		if (login === 'NIP-07') {
			await loginWithNip07();
			return;
		}

		if (login.startsWith('npub')) {
			npub = login;
			await loginWithNpub();
			return;
		}

		console.error('Login failed');
	});

	async function loginWithNip07() {
		console.log('Login with NIP-07');

		if (!(await nip07Enabled())) {
			console.error('Browser extension not found');
			return;
		}

		login = 'NIP-07';
		localStorage.setItem('nostter:login', login);

		let nip07Relays: Map<string, RelayPermission> = new Map();
		if (typeof window.nostr.getRelays === 'function') {
			nip07Relays = await window.nostr.getRelays();
			console.log(nip07Relays);
			if (nip07Relays.size === 0) {
				console.warn('Please register relays on NIP-07');
			}
		}

		const profileRelays = new Set([...Object.keys(nip07Relays), ...$defaultRelays]);
		console.log('[relays for profile]', profileRelays);

		$pubkey = await window.nostr.getPublicKey();
		console.log('[pubkey]', $pubkey);

		await fetchAuthor(Array.from(profileRelays));

		console.log('Redirect to /home');
		await goto('/home');
	}

	async function loginWithNpub() {
		console.log('npub', npub);
		const { type, data } = nip19.decode(npub);
		console.log(type, data);
		if (type !== 'npub' || typeof data !== 'string') {
			console.error(`Invalid npub: ${npub}`);
			return;
		}

		login = npub;
		localStorage.setItem('nostter:login', login);

		$pubkey = data;
		$rom = true;
		await fetchAuthor($defaultRelays);

		console.log('Redirect to /home');
		await goto('/home');
	}

	async function nip07Enabled(): Promise<boolean> {
		const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
		for (let i = 0; i < 10; i++) {
			if (window.nostr !== undefined) {
				return true;
			}
			await sleep(500);
		}
		return false;
	}

	async function fetchAuthor(relays: string[]) {
		const events = await $pool.list(relays, [
			{
				kinds: [Kind.Metadata, Kind.RecommendRelay, Kind.Contacts, Kind.RelayList],
				authors: [$pubkey]
			}
		]);
		events.sort((x, y) => x.created_at - y.created_at); // Latest event is effective
		console.log(events);

		for (const event of events) {
			switch (event.kind) {
				case Kind.Metadata: {
					$authorProfile = JSON.parse(event.content);
					console.log('[profile]', $authorProfile);
					break;
				}
				case Kind.RecommendRelay: {
					$recommendedRelay = event.content;
					console.log('[recommended relay]', $recommendedRelay);
					break;
				}
				case Kind.Contacts: {
					const relays = new Map<string, RelayPermission>(
						Object.entries(JSON.parse(event.content))
					);
					const pubkeys = new Set(event.tags.map((x) => x[1]));
					pubkeys.add($pubkey); // Add myself
					console.log(relays, pubkeys);
					$followees = Array.from(pubkeys);
					$relayUrls = Array.from(
						new Set(Array.from(relays.keys()).map((x) => new URL(x)))
					).map((x) => x.href);
					console.log('[contacts]', $relayUrls);
					break;
				}
				case Kind.RelayList: {
					$relayUrls = Array.from(new Set(event.tags.map((x) => new URL(x[1])))).map(
						(x) => x.href
					);
					console.log('[relay list]', $relayUrls);
					break;
				}
			}
		}
	}
</script>

<h3>Browser Extension</h3>
<button on:click={loginWithNip07} disabled={login !== null}>Login with NIP-07</button>

<h3>Public Key</h3>
<form on:submit|preventDefault={loginWithNpub}>
	<input
		type="text"
		bind:value={npub}
		placeholder="npub"
		pattern="^npub1[a-z0-9]+$"
		on:keyup|stopPropagation={undefined}
	/>
	<input type="submit" value="Login with npub" disabled={login !== null} />
</form>
