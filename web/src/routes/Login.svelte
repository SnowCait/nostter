<script lang="ts" context="module">
	interface Window {
		// NIP-07
		nostr: any;
	}
	declare var window: Window;
</script>

<script lang="ts">
	import { goto } from '$app/navigation';
	import { Kind, nip19, type Event, type Filter, getPublicKey } from 'nostr-tools';
	import { onMount } from 'svelte';
	import {
		pubkey,
		author,
		authorProfile,
		mutePubkeys,
		muteEventIds,
		readRelays,
		writeRelays,
		rom,
		bookmarkEvent
	} from '../stores/Author';
	import { defaultRelays } from '../stores/DefaultRelays';
	import { pool } from '../stores/Pool';
	import { reactionEmoji } from '../stores/Preference';
	import { Api } from '$lib/Api';
	import { filterTags } from '$lib/EventHelper';
	import { customEmojisEvent, customEmojiTags } from '../stores/CustomEmojis';
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

		const { replaceableEvents, parameterizedReplaceableEvents } = await $author.fetchEvents();

		const metadataEvent = replaceableEvents.get(Kind.Metadata);
		if (metadataEvent !== undefined) {
			try {
				$authorProfile = JSON.parse(metadataEvent.content);
				console.log('[profile]', $authorProfile);
			} catch (error) {
				console.warn('[invalid metadata]', error, metadataEvent);
			}
		}

		$author.saveRelays(replaceableEvents);

		$customEmojisEvent = replaceableEvents.get(10030 as Kind);
		if ($customEmojisEvent !== undefined) {
			const emojiTagsFilter = (tags: string[][]) => {
				return tags.filter(([tagName, shortcode, imageUrl]) => {
					if (tagName !== 'emoji') {
						return false;
					}
					if (shortcode === undefined || imageUrl === undefined) {
						return false;
					}
					try {
						new URL(imageUrl);
						return true;
					} catch {
						return false;
					}
				});
			};
			// emoji tags
			$customEmojiTags = emojiTagsFilter($customEmojisEvent.tags);

			// a tags
			const referenceTags = $customEmojisEvent.tags.filter(([tagName]) => tagName === 'a');
			if (referenceTags.length > 0) {
				const filters: Filter[] = referenceTags
					.map(([, reference]) => reference.split(':'))
					.filter(([kind]) => kind === `${30030 as Kind}`)
					.map(([kind, pubkey, identifier]) => {
						return {
							kinds: [Number(kind)],
							authors: [pubkey],
							'#d': [identifier]
						};
					});
				console.debug('[custom emoji #a]', referenceTags, filters);
				const api = new Api($pool, $writeRelays);
				api.fetchEvents(filters).then((events) => {
					console.debug('[custom emoji 30030]', events);
					for (const event of events) {
						$customEmojiTags.push(...emojiTagsFilter(event.tags));
					}
					$customEmojiTags = $customEmojiTags;
					console.log('[custom emoji tags]', $customEmojiTags);
				});
			}
		}

		$bookmarkEvent = parameterizedReplaceableEvents.get(`${30001 as Kind}:bookmark`);

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

	async function getMuteLists(event: Event) {
		let publicMutePubkeys: string[] = [];
		let publicMuteEventIds: string[] = [];
		let privateMutePubkeys: string[] = [];
		let privateMuteEventIds: string[] = [];

		publicMutePubkeys = filterTags('p', event.tags);
		publicMuteEventIds = filterTags('e', event.tags);

		if ((login === 'NIP-07' || login?.startsWith('nsec')) && event.content !== '') {
			try {
				const json = await Signer.decrypt($pubkey, event.content);
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
