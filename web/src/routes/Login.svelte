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
		relayUrls,
		rom
	} from '../stores/Author';
	import { defaultRelays } from '../stores/DefaultRelays';
	import { pool } from '../stores/Pool';
	import { reactionEmoji } from '../stores/Preference';
	import type { RelayPermission } from './types';

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
			return;
		}

		console.log(`NIP-07 enabled in ${Date.now() / 1000 - now} seconds`);

		login = 'NIP-07';
		localStorage.setItem('nostter:login', login);

		$pubkey = await window.nostr.getPublicKey();
		console.log('[pubkey]', $pubkey);

		console.log(`NIP-07 getPublicKey in ${Date.now() / 1000 - now} seconds`);

		let nip07Relays: Map<string, RelayPermission> = new Map();
		if (typeof window.nostr.getRelays === 'function') {
			nip07Relays = await window.nostr.getRelays();
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
		const events = await $pool.list(relays, [
			{
				kinds: [
					Kind.Metadata,
					Kind.RecommendRelay,
					Kind.Contacts,
					10000,
					Kind.RelayList,
					30000,
					30078
				],
				authors: [$pubkey]
			}
		]);
		events.sort((x, y) => x.created_at - y.created_at); // Latest event is effective
		console.log(events);

		let muteEvent: Event | undefined;
		let regacyMuteEvent: Event | undefined;
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
					const pubkeys = new Set(event.tags.map((x) => x[1]));
					pubkeys.add($pubkey); // Add myself
					$followees = Array.from(pubkeys);
					console.log('[contacts]', event.created_at, $followees);

					if (event.content === '') {
						console.log('[relays in kind 3] empty');
						break;
					}
					const relays = new Map<string, RelayPermission>(
						Object.entries(JSON.parse(event.content))
					);
					console.log(relays, pubkeys);
					$relayUrls = Array.from(
						new Set(Array.from(relays.keys()).map((x) => new URL(x)))
					).map((x) => x.href);
					console.log('[relays in kind 3]', $relayUrls);
					break;
				}
				case 10000 as Kind: {
					muteEvent = event;
					console.log('[mute event]', event);
					break;
				}
				case Kind.RelayList: {
					$relayUrls = Array.from(
						new Set(
							event.tags
								.filter(
									([tagName, relay]) =>
										tagName === 'r' &&
										(relay.startsWith('wss://') || relay.startsWith('ws://'))
								)
								.map(([, relay]) => new URL(relay))
						)
					).map((x) => x.href);
					console.log('[relay list]', $relayUrls);
					break;
				}
				case 30000 as Kind: {
					if (
						event.tags.some(
							([tagName, tagContent]) => tagName === 'd' && tagContent === 'mute'
						)
					) {
						regacyMuteEvent = event;
						console.log('[regacy mute event]', event);
					}
					break;
				}
				case 30078 as Kind: {
					if (
						event.tags.some(
							([tagName, id]) => tagName === 'd' && id === 'nostter-reaction-emoji'
						)
					) {
						$reactionEmoji = event.content;
						console.log('[reaction emoji]', $reactionEmoji);
					}
					break;
				}
			}
		}

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

		console.log('[relays]', $relayUrls);
		if ($relayUrls.length === 0) {
			$relayUrls = $defaultRelays;
			console.log('[relays]', $relayUrls);
		}
	}

	function filterTags(tagName: string, tags: string[][]) {
		return tags
			.filter(([name, content]) => name === tagName && content !== undefined)
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
			const json = await window.nostr.nip04.decrypt($pubkey, event.content);
			const tags = JSON.parse(json) as string[][];
			privateMutePubkeys = filterTags('p', tags);
			privateMuteEventIds = filterTags('e', tags);
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
