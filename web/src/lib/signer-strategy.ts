import { type Event, nip19, type EventTemplate, getPublicKey } from 'nostr-tools';
import { BunkerSigner, parseBunkerInput } from 'nostr-tools/nip46';
import { generateSecretKey } from 'nostr-tools/pure';
import { bytesToHex, hexToBytes } from 'nostr-tools/utils';
import { WebStorage } from './WebStorage';
import { nip46ConnectTimeout } from './Constants';
import type * as Nostr from 'nostr-typedef';
import { BrowserSigner } from './nostr/signing/browser-signer';
import { PrivateKeySigner } from './nostr/signing/private-key-signer';
import type { Signer } from './nostr/signing/signer';

let bunkerSigner: BunkerSigner | undefined;
let nip46CachedPublicKey: string | undefined;

export async function establishBunkerConnection(bunker: string): Promise<void> {
	const bunkerPointer = await parseBunkerInput(bunker);
	if (!bunkerPointer) throw new Error(`Failed to parse bunker URL`);

	const storage = new WebStorage(localStorage);
	const clientSeckeyHex = storage.get('login:bunker:client-seckey');
	let clientSeckey: Uint8Array;
	if (clientSeckeyHex) {
		clientSeckey = hexToBytes(clientSeckeyHex);
	} else {
		clientSeckey = generateSecretKey();
		storage.set('login:bunker:client-seckey', bytesToHex(clientSeckey));
	}

	let authRequested = false;
	bunkerSigner = BunkerSigner.fromBunker(clientSeckey, bunkerPointer, {
		onauth: (url) => {
			authRequested = true;
			open(url, '_blank');
		}
	});
	console.debug('[NIP-46 client pubkey]', getPublicKey(clientSeckey));

	const signer = bunkerSigner;
	const { promise: timeout, reject: rejectOnTimeout } = Promise.withResolvers<never>();
	const timer = setTimeout(() => {
		if (!authRequested) {
			rejectOnTimeout(new Error('NIP-46 connection timed out'));
		}
	}, nip46ConnectTimeout);
	try {
		await Promise.race([
			(async () => {
				await signer.connect();
				console.debug('[NIP-46 connected]');
				nip46CachedPublicKey = await signer.getPublicKey();
			})(),
			timeout
		]);
	} finally {
		clearTimeout(timer);
	}
	console.debug('[NIP-46 user pubkey]', nip46CachedPublicKey);
}

export async function abolishBunkerConnection(): Promise<void> {
	if (bunkerSigner) {
		try {
			await bunkerSigner.close();
		} catch (e) {
			console.debug('[NIP-46] close error', e);
		}
		bunkerSigner = undefined;
		nip46CachedPublicKey = undefined;
	}
}

class Nip46Signer implements Signer {
	async getPublicKey(): Promise<string> {
		return nip46CachedPublicKey!;
	}

	async signEvent(unsignedEvent: EventTemplate | Nostr.UnsignedEvent): Promise<Event> {
		return await bunkerSigner!.signEvent(unsignedEvent);
	}

	async encrypt(pubkey: string, plaintext: string): Promise<string> {
		return await bunkerSigner!.nip04Encrypt(pubkey, plaintext);
	}

	async decrypt(pubkey: string, ciphertext: string): Promise<string> {
		return await bunkerSigner!.nip04Decrypt(pubkey, ciphertext);
	}

	async encryptNip44(pubkey: string, plaintext: string): Promise<string> {
		return await bunkerSigner!.nip44Encrypt(pubkey, plaintext);
	}

	async decryptNip44(pubkey: string, ciphertext: string): Promise<string> {
		return await bunkerSigner!.nip44Decrypt(pubkey, ciphertext);
	}
}

export const resolveSigner = (): Signer => {
	const storage = new WebStorage(localStorage);
	const login = storage.get('login');
	if (login === null) {
		throw new Error('[logic error]');
	}

	if (login === 'NIP-07') {
		return new BrowserSigner();
	} else if (login.startsWith('bunker://')) {
		return new Nip46Signer();
	} else if (login.startsWith('nsec')) {
		const result = nip19.decode(login);
		if (result.type !== 'nsec') {
			throw new Error('[logic error]');
		}
		return new PrivateKeySigner(result.data);
	} else {
		throw new Error('[logic error]');
	}
};
