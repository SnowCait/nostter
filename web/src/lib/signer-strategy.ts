import {
	type Event,
	nip19,
	type EventTemplate,
	getPublicKey,
	nip04,
	finalizeEvent,
	nip44
} from 'nostr-tools';
import { BunkerSigner, parseBunkerInput } from 'nostr-tools/nip46';
import { generateSecretKey } from 'nostr-tools/pure';
import { bytesToHex, hexToBytes } from 'nostr-tools/utils';
import { WebStorage } from './WebStorage';
import { nip46ConnectTimeout } from './Constants';
import type * as Nostr from 'nostr-typedef';
import { type LoginType, signerCanSign } from './signer-capability';

declare const window: {
	nostr: Nostr.Nip07.Nostr | undefined;
};

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

interface SignerStrategy {
	readonly type: LoginType;
	readonly canSign: boolean;
	getPublicKey(): Promise<string>;
	signEvent(unsignedEvent: EventTemplate | Nostr.UnsignedEvent): Promise<Event>;
	encrypt(pubkey: string, plaintext: string): Promise<string>;
	decrypt(pubkey: string, ciphertext: string): Promise<string>;
	encryptNip44(pubkey: string, plaintext: string): Promise<string>;
	decryptNip44(pubkey: string, ciphertext: string): Promise<string>;
}

class Nip07Signer implements SignerStrategy {
	readonly type: LoginType = 'NIP-07';
	readonly canSign = signerCanSign(this.type);

	async getPublicKey(): Promise<string> {
		if (window.nostr !== undefined) {
			return window.nostr.getPublicKey();
		}
		throw new Error('[logic error]');
	}

	async signEvent(unsignedEvent: EventTemplate | Nostr.UnsignedEvent): Promise<Event> {
		if (window.nostr !== undefined) {
			return await window.nostr.signEvent(unsignedEvent);
		}
		throw new Error('[logic error]');
	}

	async encrypt(pubkey: string, plaintext: string): Promise<string> {
		if (window.nostr !== undefined && window.nostr.nip04 !== undefined) {
			return await window.nostr.nip04.encrypt(pubkey, plaintext);
		}
		throw new Error('[logic error]');
	}

	async decrypt(pubkey: string, ciphertext: string): Promise<string> {
		if (window.nostr !== undefined && window.nostr.nip04 !== undefined) {
			return await window.nostr.nip04.decrypt(pubkey, ciphertext);
		}
		throw new Error('[logic error]');
	}

	async encryptNip44(pubkey: string, plaintext: string): Promise<string> {
		if (window.nostr !== undefined && window.nostr.nip44 !== undefined) {
			return await window.nostr.nip44.encrypt(pubkey, plaintext);
		}
		throw new Error('[logic error]');
	}

	async decryptNip44(pubkey: string, ciphertext: string): Promise<string> {
		if (window.nostr !== undefined && window.nostr.nip44 !== undefined) {
			return await window.nostr.nip44.decrypt(pubkey, ciphertext);
		}
		throw new Error('[logic error]');
	}
}

class Nip46Signer implements SignerStrategy {
	readonly type: LoginType = 'NIP-46';
	readonly canSign = signerCanSign(this.type);

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

class NsecSigner implements SignerStrategy {
	readonly type: LoginType = 'nsec';
	readonly canSign = signerCanSign(this.type);

	constructor(private readonly login: string) {}

	async getPublicKey(): Promise<string> {
		const { data: seckey } = nip19.decode(this.login);
		return getPublicKey(seckey as Uint8Array);
	}

	async signEvent(unsignedEvent: EventTemplate | Nostr.UnsignedEvent): Promise<Event> {
		const { data: seckey } = nip19.decode(this.login);
		return finalizeEvent(unsignedEvent, seckey as Uint8Array);
	}

	async encrypt(pubkey: string, plaintext: string): Promise<string> {
		const { data: seckey } = nip19.decode(this.login);
		return await nip04.encrypt(seckey as string, pubkey, plaintext);
	}

	async decrypt(pubkey: string, ciphertext: string): Promise<string> {
		const { data: seckey } = nip19.decode(this.login);
		return await nip04.decrypt(seckey as string, pubkey, ciphertext);
	}

	async encryptNip44(pubkey: string, plaintext: string): Promise<string> {
		const result = nip19.decode(this.login);
		if (result.type !== 'nsec') {
			throw new Error('[logic error]');
		}
		const seckey = result.data;
		const conversationKey = nip44.getConversationKey(seckey, pubkey);
		return await nip44.encrypt(plaintext, conversationKey);
	}

	async decryptNip44(pubkey: string, ciphertext: string): Promise<string> {
		const result = nip19.decode(this.login);
		if (result.type !== 'nsec') {
			throw new Error('[logic error]');
		}
		const seckey = result.data;
		const conversationKey = nip44.getConversationKey(seckey, pubkey);
		return await nip44.decrypt(ciphertext, conversationKey);
	}
}

class NpubSigner implements SignerStrategy {
	readonly type: LoginType = 'npub';
	readonly canSign = signerCanSign(this.type);

	async getPublicKey(): Promise<string> {
		throw new Error('[logic error]');
	}

	async signEvent(): Promise<Event> {
		throw new Error('[logic error]');
	}

	async encrypt(): Promise<string> {
		throw new Error('[logic error]');
	}

	async decrypt(): Promise<string> {
		throw new Error('[logic error]');
	}

	async encryptNip44(): Promise<string> {
		throw new Error('[logic error]');
	}

	async decryptNip44(): Promise<string> {
		throw new Error('[logic error]');
	}
}

export const resolveSigner = (): SignerStrategy => {
	const storage = new WebStorage(localStorage);
	const login = storage.get('login');
	if (login === null) {
		throw new Error('[logic error]');
	}

	if (login === 'NIP-07') {
		return new Nip07Signer();
	} else if (login.startsWith('bunker://')) {
		return new Nip46Signer();
	} else if (login.startsWith('nsec')) {
		return new NsecSigner(login);
	} else if (login.startsWith('npub')) {
		return new NpubSigner();
	} else {
		throw new Error('[logic error]');
	}
};
