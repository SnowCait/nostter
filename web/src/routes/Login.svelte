<script lang="ts" context="module">
	interface Window {
		// NIP-07
		nostr: any;
	}
	declare var window: Window;
</script>

<script lang="ts">
	import { goto } from '$app/navigation';
	import { Kind, nip19, type Event } from 'nostr-tools';
	import { onMount } from 'svelte';
	import {
		pubkey,
		authorProfile,
		recommendedRelay,
		followees,
		mutePubkeys,
		muteEventIds,
		readRelays,
		writeRelays,
		rom,
		updateRelays
	} from '../stores/Author';
	import { defaultRelays } from '../stores/DefaultRelays';
	import { pool } from '../stores/Pool';
	import { reactionEmoji } from '../stores/Preference';
	import { Api } from '$lib/Api';

	let login: string | null = null;
	let npub = '';

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
		} else if (login.startsWith('npub')) {
			npub = login;
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

		try {
			$pubkey = await window.nostr.getPublicKey();
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

		let nip07Relays: Map<string, { read: boolean; write: boolean }> = new Map();
		if (typeof window.nostr.getRelays === 'function') {
			try {
				nip07Relays = await window.nostr.getRelays();
			} catch (error) {
				console.error('[NIP-07 getRelays()]', error);
			}
			console.log(nip07Relays);
			if (nip07Relays.size === 0) {
				console.warn('Please register relays on NIP-07');
			}
		}

		console.log(`NIP-07 getRelays in ${Date.now() / 1000 - now} seconds`);

		const profileRelays = new Set([...Object.keys(nip07Relays), ...$defaultRelays]);
		console.log('[relays for profile]', profileRelays);

		await fetchAuthor(Array.from(profileRelays));

		console.log(`Fetch author in ${Date.now() / 1000 - now} seconds`);

		await gotoHome();
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

		const api = new Api($pool, relays);
		const [replaceableEvents, parameterizedReplaceableEvents] = await api.fetchAuthorEvents(
			$pubkey
		);
		api.close();

		const metadataEvent = replaceableEvents.get(Kind.Metadata);
		if (metadataEvent !== undefined) {
			try {
				$authorProfile = JSON.parse(metadataEvent.content);
				console.log('[profile]', $authorProfile);
			} catch (error) {
				console.error('[invalid metadata]', error, metadataEvent);
			}
		}

		const recommendedRelayEvent = replaceableEvents.get(Kind.RecommendRelay);
		if (recommendedRelayEvent !== undefined) {
			$recommendedRelay = recommendedRelayEvent.content;
			console.log('[recommended relay]', $recommendedRelay);
		}

		const contactsEvent = replaceableEvents.get(Kind.Contacts);
		if (contactsEvent !== undefined) {
			const pubkeys = new Set(filterTags('p', contactsEvent.tags));
			pubkeys.add($pubkey); // Add myself
			$followees = Array.from(pubkeys);
			console.log('[contacts]', pubkeys);

			if (contactsEvent.content === '') {
				console.log('[relays in kind 3] empty');
			} else {
				const relays = new Map<string, { read: boolean; write: boolean }>(
					Object.entries(JSON.parse(contactsEvent.content))
				);
				const validRelays = [...relays].filter(([relay]) => {
					try {
						const url = new URL(relay);
						return url.protocol === 'wss:' || url.protocol === 'ws:';
					} catch {
						return false;
					}
				});
				console.log(relays, pubkeys);
				$readRelays = Array.from(
					new Set(validRelays.filter(([, { read }]) => read).map(([relay]) => relay))
				);
				$writeRelays = Array.from(
					new Set(validRelays.filter(([, { write }]) => write).map(([relay]) => relay))
				);
				console.log('[relays in kind 3]', $readRelays, $writeRelays);
			}
		}

		const relayListEvent = replaceableEvents.get(Kind.RelayList);
		if (
			relayListEvent !== undefined &&
			(contactsEvent === undefined ||
				contactsEvent.content === '' ||
				contactsEvent.created_at < relayListEvent.created_at)
		) {
			updateRelays(relayListEvent);
			console.log('[relays in kind 10002]', $readRelays, $writeRelays);
		}

		const reactionEmojiEvent = parameterizedReplaceableEvents.get(
			`${30078 as Kind}:nostter-reaction-emoji`
		);
		if (reactionEmojiEvent !== undefined) {
			$reactionEmoji = reactionEmojiEvent.content;
			console.log('[reaction emoji]', $reactionEmoji);
		}

		const muteEvent = replaceableEvents.get(10000 as Kind);
		const regacyMuteEvent = parameterizedReplaceableEvents.get(`${30000 as Kind}:mute`);

		let modernMutePubkeys: string[] = [];
		let modernMuteEventIds: string[] = [];
		let regacyMutePubkeys: string[] = [];
		let regacyMuteEventIds: string[] = [];

		if (muteEvent !== undefined) {
			const muteLists = await getMuteLists(muteEvent);
			modernMutePubkeys = muteLists.pubkeys;
			modernMuteEventIds = muteLists.eventIds;
		}

		if (regacyMuteEvent !== undefined) {
			const muteLists = await getMuteLists(regacyMuteEvent);
			regacyMutePubkeys = muteLists.pubkeys;
			regacyMuteEventIds = muteLists.eventIds;
		}

		$mutePubkeys = Array.from(new Set([...modernMutePubkeys, ...regacyMutePubkeys]));
		console.log('[mute pubkeys]', $mutePubkeys);

		$muteEventIds = Array.from(new Set([...modernMuteEventIds, ...regacyMuteEventIds]));
		console.log('[mute eventIds]', $muteEventIds);

		console.log('[relays]', $readRelays, $writeRelays);

		console.timeEnd('fetch author');
	}

	function filterTags(tagName: string, tags: string[][]) {
		return tags
			.filter(
				([name, content]) => name === tagName && content !== undefined && content !== ''
			)
			.map(([, content]) => content);
	}

	async function getMuteLists(event: Event) {
		let publicMutePubkeys: string[] = [];
		let publicMuteEventIds: string[] = [];
		let privateMutePubkeys: string[] = [];
		let privateMuteEventIds: string[] = [];

		publicMutePubkeys = filterTags('p', event.tags);
		publicMuteEventIds = filterTags('e', event.tags);

		if (login === 'NIP-07' && window.nostr.nip04 !== undefined && event.content !== '') {
			try {
				const json = await window.nostr.nip04.decrypt($pubkey, event.content);
				const tags = JSON.parse(json) as string[][];
				privateMutePubkeys = filterTags('p', tags);
				privateMuteEventIds = filterTags('e', tags);
			} catch (error) {
				console.error('[NIP-07 nip04.decrypt()]', error);
			}
		}

		console.log('[mute p list]', publicMutePubkeys, privateMutePubkeys);
		console.log('[mute e list]', publicMuteEventIds, privateMuteEventIds);

		return {
			pubkeys: Array.from(new Set([...publicMutePubkeys, ...privateMutePubkeys])),
			eventIds: Array.from(new Set([...publicMuteEventIds, ...privateMuteEventIds]))
		};
	}
</script>

<button on:click={loginWithNip07} disabled={login !== null}>
	Login with NIP-07 Browser Extension</button
>
<span>(Recommended)</span>

<div>or</div>

<form on:submit|preventDefault={loginWithNpub}>
	<input
		type="text"
		bind:value={npub}
		placeholder="npub"
		pattern="^npub1[a-z0-9]+$"
		required
		on:keyup|stopPropagation={() => console.debug()}
	/>
	<input type="submit" value="Login with npub" disabled={login !== null} />
</form>
