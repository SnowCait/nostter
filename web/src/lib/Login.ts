import { get } from 'svelte/store';
import { authorProfile } from './stores/Author';
import { nip19 } from 'nostr-tools';
import { robohash } from './Items';
import { WebStorage } from './WebStorage';
import { rxNostr } from './timelines/MainTimeline';
import { now } from 'rx-nostr';
import type { User } from '../routes/types';
import { remoteSigner } from './RemoteSigner';
import { setLoginStatus, clearLoginStatus } from './stores/LoginStatus';
import { auth, type LoginMethod } from './auth.svelte';
import { initializeAccount } from './features/account/application/initialize-account';
import { loadFolloweesOfFollowees } from './features/notifications/application/followees-of-followees';
import { notificationVisibility } from './preferences/NotificationVisibility.svelte';
import { createListContentDecrypter } from './List';
import { BrowserSigner } from './nostr/signing/browser-signer';
import { PrivateKeySigner } from './nostr/signing/private-key-signer';
import type { Signer as SigningSigner } from './nostr/signing/signer';
import { establishBunkerConnection } from './nip46-connection';

type BasicInfoSigner = Pick<SigningSigner, 'getPublicKey' | 'signEvent'>;

async function disposeSigner(signer: SigningSigner | undefined): Promise<void> {
	try {
		await signer?.dispose?.();
	} catch (error) {
		console.debug('[signer] dispose error', error);
	}
}

export class Login {
	public async saveBasicInfo(name: string, signer: BasicInfoSigner): Promise<void> {
		console.debug('[relays]', rxNostr.getDefaultRelays());

		const pubkey = await signer.getPublicKey();
		const user = {
			name,
			display_name: name,
			picture: robohash(pubkey)
		} as User;
		const metadataEvent = await signer.signEvent({
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

		const relayListEvent = await signer.signEvent({
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

		setLoginStatus('getting_pubkey');

		const signer = new BrowserSigner();
		let pubkey: string;
		try {
			pubkey = await signer.getPublicKey();
			if (!pubkey) {
				throw new Error('undefined');
			}
			console.debug('[pubkey]', pubkey);
		} catch (error) {
			console.error('[NIP-07 getPublicKey()]', error);
			console.timeEnd('NIP-07');
			setLoginStatus('failed', 'error');
			return;
		}

		console.timeLog('NIP-07');

		await this.fetchAuthor(pubkey, 'NIP-07', signer);

		console.timeEnd('NIP-07');
	}

	public async withNip46(bunker: string): Promise<boolean> {
		console.debug('Login with NIP-46');
		console.time('NIP-46');

		setLoginStatus('connecting_bunker');

		let signer: SigningSigner;
		try {
			signer = await establishBunkerConnection(bunker);
		} catch {
			console.timeEnd('NIP-46 error');
			console.error('Failed to connect to NIP-46 bunker');
			setLoginStatus('bunker_failed', 'error');
			return false;
		}

		const storage = new WebStorage(localStorage);
		storage.set('login', bunker);

		try {
			const pubkey = await signer.getPublicKey();
			await this.fetchAuthor(pubkey, 'NIP-46', signer);
		} catch (error) {
			await disposeSigner(signer);
			throw error;
		}

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

		const signer = new PrivateKeySigner(seckey);
		const pubkey = await signer.getPublicKey();
		await this.fetchAuthor(pubkey, 'nsec', signer);
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

		await this.fetchAuthor(data, 'npub');
	}

	private async fetchAuthor(pubkey: string, loginMethod: LoginMethod, signer?: SigningSigner) {
		console.time('fetch author');
		setLoginStatus('fetching_profile');

		const decryptPrivateListContent = signer ? createListContentDecrypter(signer) : undefined;
		const followingPubkeys = await initializeAccount(pubkey, decryptPrivateListContent);
		console.timeEnd('fetch author');

		auth.establish({ pubkey, followingPubkeys, loginMethod, signer });
		clearLoginStatus();

		if (get(notificationVisibility) === 'follows_of_follows') {
			loadFolloweesOfFollowees(auth.followees);
		}

		if (signer !== undefined) {
			remoteSigner.subscribeIfEnabled();
		}
	}
}

export async function resetLoginState(): Promise<void> {
	const disposingSigner = disposeSigner(auth.signer);
	auth.reset();
	await disposingSigner;
}

export async function logout(): Promise<void> {
	await resetLoginState();
	new WebStorage(localStorage).clear();
	location.href = '/';
}

export async function tryLogin(): Promise<boolean> {
	try {
		const storage = new WebStorage(localStorage);
		const savedLogin = storage.get('login');

		if (savedLogin === null) {
			return false;
		}

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

		return auth.status === 'authenticated';
	} catch (error) {
		console.error('[tryLogin()]', error);
		setLoginStatus('failed', 'error');
		return false;
	} finally {
		if (auth.status !== 'authenticated') {
			await resetLoginState();
		}
	}
}
