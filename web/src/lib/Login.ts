import { get } from 'svelte/store';
import { author, loginType, pubkey, rom } from '../stores/Author';
import { Signer } from './Signer';
import { defaultRelays } from './Constants';
import { Author } from './Author';
import { generatePrivateKey, getPublicKey, nip19 } from 'nostr-tools';
import { WebStorage } from './WebStorage';

interface Window {
	// NIP-07
	nostr: any;
}
declare const window: Window;

export class Login {
	private async nip07Enabled(): Promise<boolean> {
		const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
		for (let i = 0; i < 20; i++) {
			if (window.nostr !== undefined) {
				return true;
			}
			await sleep(500);
		}
		return false;
	}

	public async generateNsec() {
		const seckey = generatePrivateKey();
		await this.withNsec(nip19.nsecEncode(seckey));
	}

	public async withNip07() {
		console.log('Login with NIP-07');
		console.time('NIP-07');

		if (!(await this.nip07Enabled())) {
			console.error('Browser extension not found');
			return;
		}

		console.timeLog('NIP-07');

		const storage = new WebStorage(localStorage);
		storage.set('login', 'NIP-07');

		loginType.set('NIP-07');
		try {
			pubkey.set(await Signer.getPublicKey());
			const $pubkey = get(pubkey);
			if (!$pubkey) {
				throw new Error('undefined');
			}
			console.log('[pubkey]', $pubkey);
		} catch (error) {
			console.error('[NIP-07 getPublicKey()]', error);
			console.timeEnd('NIP-07');
			return;
		}

		console.timeLog('NIP-07');

		const nip07Relays = await Signer.getRelays();

		console.log('[NIP-07 relays]', nip07Relays);
		console.timeLog('NIP-07');

		const profileRelays = new Set([...Object.keys(nip07Relays), ...defaultRelays]);
		console.log('[relays for profile]', profileRelays);

		await this.fetchAuthor(Array.from(profileRelays));

		console.timeEnd('NIP-07');
	}

	public async withNsec(key: string) {
		const { type, data: seckey } = nip19.decode(key);
		if (type !== 'nsec' || typeof seckey !== 'string') {
			console.error('Invalid nsec');
			return;
		}

		const storage = new WebStorage(localStorage);
		storage.set('login', key);

		loginType.set('nsec');
		pubkey.set(getPublicKey(seckey));
		await this.fetchAuthor(defaultRelays);
	}

	public async withNpub(key: string) {
		console.log('npub', key);
		const { type, data } = nip19.decode(key);
		console.log(type, data);
		if (type !== 'npub' || typeof data !== 'string') {
			console.error(`Invalid npub: ${key}`);
			return;
		}

		const storage = new WebStorage(localStorage);
		storage.set('login', key);

		loginType.set('npub');
		pubkey.set(data);
		rom.set(true);
		await this.fetchAuthor(defaultRelays);
	}

	private async fetchAuthor(relays: string[]) {
		console.time('fetch author');

		const $author = new Author(get(pubkey));

		await $author.fetchRelays(relays);
		console.timeLog('fetch author');

		await $author.fetchEvents();
		console.timeEnd('fetch author');

		author.set($author);
	}
}
