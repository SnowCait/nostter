<script lang="ts" context="module">
	interface Window {
		// NIP-07
		nostr: any;
	}
	declare var window: Window;
</script>

<script lang="ts">
	import { goto } from '$app/navigation';
	import { nip19, getPublicKey } from 'nostr-tools';
	import { onMount } from 'svelte';
	import { pubkey, author, authorProfile, rom, loginType } from '../stores/Author';
	import { defaultRelays } from '../stores/DefaultRelays';
	import { Signer } from '$lib/Signer';
	import { Author } from '$lib/Author';

	let login: string | null = null;
	let key = '';

	const now = Math.floor(Date.now() / 1000);

	onMount(async () => {
		console.log('onMount');

		login = localStorage.getItem('nostter:login');
		console.log('[login]', login);

		if (login === null) {
			return;
		}

		if (login === 'NIP-07') {
			await loginWithNip07();
		} else if (login.startsWith('nsec')) {
			key = login;
			await loginWithNsec();
		} else if (login.startsWith('npub')) {
			key = login;
			await loginWithNpub();
		} else {
			console.error('[logic error]', 'login');
		}
	});

	async function loginWithNip07() {
		console.log('Login with NIP-07');

		if (!(await nip07Enabled())) {
			console.error('Browser extension not found');
			login = null;
			return;
		}

		console.log(`NIP-07 enabled in ${Date.now() / 1000 - now} seconds`);

		login = 'NIP-07';
		localStorage.setItem('nostter:login', login);

		$loginType = 'NIP-07';
		try {
			$pubkey = await Signer.getPublicKey();
			if (!$pubkey) {
				throw new Error('undefined');
			}
		} catch (error) {
			console.error('[NIP-07 getPublicKey()]', error);
			login = null;
			return;
		}
		console.log('[pubkey]', $pubkey);

		console.log(`NIP-07 getPublicKey in ${Date.now() / 1000 - now} seconds`);

		const nip07Relays = Signer.getRelays();

		console.log(`NIP-07 getRelays in ${Date.now() / 1000 - now} seconds`);

		const profileRelays = new Set([...Object.keys(nip07Relays), ...$defaultRelays]);
		console.log('[relays for profile]', profileRelays);

		await fetchAuthor(Array.from(profileRelays));

		console.log(`Fetch author in ${Date.now() / 1000 - now} seconds`);

		await gotoHome();
	}

	async function loginWithNsec() {
		const { type, data: seckey } = nip19.decode(key);
		if (type !== 'nsec' || typeof seckey !== 'string') {
			console.error('Invalid nsec');
			return;
		}

		login = key;
		localStorage.setItem('nostter:login', login);

		$loginType = 'nsec';
		$pubkey = getPublicKey(seckey);
		await fetchAuthor($defaultRelays);
		await gotoHome();
	}

	async function loginWithNpub() {
		console.log('npub', key);
		const { type, data } = nip19.decode(key);
		console.log(type, data);
		if (type !== 'npub' || typeof data !== 'string') {
			console.error(`Invalid npub: ${key}`);
			return;
		}

		login = key;
		localStorage.setItem('nostter:login', login);

		$loginType = 'npub';
		$pubkey = data;
		$rom = true;
		await fetchAuthor($defaultRelays);
		await gotoHome();
	}

	async function gotoHome() {
		if ($authorProfile === undefined) {
			console.error('[login failed]');
			return;
		}

		const url = '/home';
		console.log(`Redirect to ${url}`);
		await goto(url);
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
		console.time('fetch author');

		$author = new Author($pubkey);

		await $author.fetchRelays(relays);
		console.timeLog('fetch author');

		await $author.fetchEvents();
	}
</script>

<button on:click={loginWithNip07} disabled={login !== null}>
	Login with NIP-07 Browser Extension
</button>
<span>(Recommended)</span>

<div>or</div>

<form on:submit|preventDefault={() => (key.startsWith('nsec') ? loginWithNsec() : loginWithNpub())}>
	<input
		type="text"
		bind:value={key}
		placeholder="npub or nsec"
		pattern="^(npub|nsec)1[a-z0-9]+$"
		required
		on:keyup|stopPropagation={() => console.debug()}
	/>
	<input type="submit" value="Login with key" disabled={login !== null} />
</form>
