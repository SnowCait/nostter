import { get } from 'svelte/store';
import { author, authorProfile, followees, loginType, pubkey, rom } from './stores/Author';
import { Signer } from './Signer';
import { Author } from './Author';
import { getPublicKey, nip19 } from 'nostr-tools';
import { robohash } from './Items';
import { WebStorage } from './WebStorage';
import { rxNostr } from './timelines/MainTimeline';
import { loadFolloweesMetadataCache } from './cache/Events';
import { now } from 'rx-nostr';
import type { User } from '../routes/types';
import { remoteSigner } from './RemoteSigner';
import { setLoginStatus, clearLoginStatus } from './stores/LoginStatus';
import { auth } from './auth.svelte';

export class Login {
	public async saveBasicInfo(name: string): Promise<void> {
		console.debug('[relays]', rxNostr.getDefaultRelays());

		const pubkey = await Signer.getPublicKey();
		const user = {
			name,
			display_name: name,
			picture: robohash(pubkey)
		} as User;
		const metadataEvent = await Signer.signEvent({
			kind: 0,
			content: JSON.stringify(user),
			tags: [],
			created_at: now()
		});
		console.debug('[kind 0]', metadataEvent);
		rxNostr.send(metadataEvent).subscribe((packet) => {
			console.debug('[save metadata]', packet);
		});
		authorProfile.set(user);

		const relayListEvent = await Signer.signEvent({
			kind: 10002,
			content: '',
			tags: Object.entries(rxNostr.getDefaultRelays()).map(([, { url, read, write }]) => {
				const tag = ['r', url];
				if (read && !write) {
					tag.push('read');
				} else if (!read && write) {
					tag.push('write');
				}
				return tag;
			}),
			created_at: now()
		});
		console.debug('[kind 10002]', relayListEvent);
		rxNostr.send(relayListEvent).subscribe((packet) => {
			console.debug('[save relay list]', packet);
		});
	}

	public async withNip07() {
		console.debug('Login with NIP-07');
		console.time('NIP-07');

		loginType.set('NIP-07');
		setLoginStatus('getting_pubkey');

		try {
			pubkey.set(await Signer.getPublicKey());
			const $pubkey = get(pubkey);
			if (!$pubkey) {
				throw new Error('undefined');
			}
			console.debug('[pubkey]', $pubkey);
		} catch (error) {
			console.error('[NIP-07 getPublicKey()]', error);
			console.timeEnd('NIP-07');
			loginType.set(undefined);
			setLoginStatus('failed', 'error');
			return;
		}

		console.timeLog('NIP-07');

		await this.fetchAuthor();

		console.timeEnd('NIP-07');
	}

	public async withNip46(bunker: string): Promise<boolean> {
		console.debug('Login with NIP-46');
		console.time('NIP-46');

		loginType.set('NIP-46');
		setLoginStatus('connecting_bunker');

		try {
			await Signer.establishBunkerConnection(bunker);
		} catch {
			console.timeEnd('NIP-46 error');
			console.error('Failed to connect to NIP-46 bunker');
			await Signer.abolishBunkerConnection();
			loginType.set(undefined);
			setLoginStatus('bunker_failed', 'error');
			return false;
		}

		const storage = new WebStorage(localStorage);
		storage.set('login', bunker);

		pubkey.set(await Signer.getPublicKey());
		await this.fetchAuthor();

		console.timeEnd('NIP-46');
		return true;
	}

	public async withNsec(key: string) {
		const { type, data: seckey } = nip19.decode(key);
		if (type !== 'nsec') {
			console.error('Invalid nsec');
			setLoginStatus('invalid_key', 'error');
			return;
		}

		const storage = new WebStorage(localStorage);
		storage.set('login', key);

		loginType.set('nsec');
		pubkey.set(getPublicKey(seckey));
		await this.fetchAuthor();
	}

	public async withNpub(key: string) {
		console.debug('npub', key);
		const { type, data } = nip19.decode(key);
		console.debug(type, data);
		if (type !== 'npub' || typeof data !== 'string') {
			console.error(`Invalid npub: ${key}`);
			setLoginStatus('invalid_key', 'error');
			return;
		}

		const storage = new WebStorage(localStorage);
		storage.set('login', key);

		loginType.set('npub');
		pubkey.set(data);
		rom.set(true);
		await this.fetchAuthor();
	}

	private async fetchAuthor() {
		console.time('fetch author');
		setLoginStatus('fetching_profile');

		const $author = new Author(get(pubkey));

		await $author.fetchRelays();
		console.timeLog('fetch author');

		await $author.fetchEvents();
		console.timeEnd('fetch author');

		await loadFolloweesMetadataCache(get(followees));

		author.set($author);
		auth.setAuthenticated();
		clearLoginStatus();

		remoteSigner.subscribeIfEnabled();
	}
}

export async function tryLogin(): Promise<boolean> {
	try {
		const storage = new WebStorage(localStorage);
		const savedLogin = storage.get('login');

		if (savedLogin === null) {
			return false;
		}

		auth.beginRestoring();
		setLoginStatus('checking');

		const login = new Login();
		if (savedLogin === 'NIP-07') {
			setLoginStatus('waiting_extension');
			const { waitNostr } = await import('nip07-awaiter');
			const nostr = await waitNostr(10000);
			console.debug('[NIP-07]', nostr);
			if (nostr === undefined) {
				console.error('Browser Extension was not found');
				setLoginStatus('extension_not_found', 'error');
				return false;
			}
			await login.withNip07();
		} else if (savedLogin.startsWith('bunker://')) {
			const success = await login.withNip46(savedLogin);
			if (!success) {
				return false;
			}
		} else if (savedLogin.startsWith('nsec')) {
			await login.withNsec(savedLogin);
		} else if (savedLogin.startsWith('npub')) {
			await login.withNpub(savedLogin);
		} else {
			console.error('[login logic error]');
			setLoginStatus('failed', 'error');
			return false;
		}

		return true;
	} finally {
		if (auth.status !== 'authenticated') {
			auth.setAnonymous();
		}
	}
}
