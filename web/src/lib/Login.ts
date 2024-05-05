import { get } from 'svelte/store';
import { author, authorProfile, loginType, pubkey, rom } from './stores/Author';
import { Signer } from './Signer';
import { Author } from './Author';
import { getPublicKey, nip19 } from 'nostr-tools';
import { robohash } from './Items';
import { WebStorage } from './WebStorage';
import { rxNostr } from './timelines/MainTimeline';
import { now } from 'rx-nostr';
import type { User } from '../routes/types';

export class Login {
	public async saveBasicInfo(name: string): Promise<void> {
		console.log('[relays]', rxNostr.getDefaultRelays());

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
		console.log('[kind 0]', metadataEvent);
		rxNostr.send(metadataEvent).subscribe((packet) => {
			console.log('[save metadata]', packet);
		});
		authorProfile.set(user);

		const relayListEvent = await Signer.signEvent({
			kind: 10002,
			content: '',
			tags: rxNostr.getRelays().map(({ url, read, write }) => {
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
		console.log('[kind 10002]', relayListEvent);
		rxNostr.send(relayListEvent).subscribe((packet) => {
			console.log('[save relay list]', packet);
		});
	}

	public async withNip07() {
		console.log('Login with NIP-07');
		console.time('NIP-07');

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

		rxNostr.addDefaultRelays(nip07Relays);
		console.log('[relays for profile]', rxNostr.getDefaultRelays());

		await this.fetchAuthor();

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
		await this.fetchAuthor();
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
		await this.fetchAuthor();
	}

	private async fetchAuthor() {
		console.time('fetch author');

		const $author = new Author(get(pubkey));

		await $author.fetchRelays();
		console.timeLog('fetch author');

		await $author.fetchEvents();
		console.timeEnd('fetch author');

		author.set($author);
	}
}
