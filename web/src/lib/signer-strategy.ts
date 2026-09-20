import { nip19, getPublicKey } from 'nostr-tools';
import { parseBunkerInput } from 'nostr-tools/nip46';
import { generateSecretKey } from 'nostr-tools/pure';
import { bytesToHex, hexToBytes } from 'nostr-tools/utils';
import { WebStorage } from './WebStorage';
import { nip46ConnectTimeout } from './Constants';
import { BrowserSigner } from './nostr/signing/browser-signer';
import { PrivateKeySigner } from './nostr/signing/private-key-signer';
import { RemoteSignerClient } from './nostr/signing/remote-signer-client';
import type { Signer } from './nostr/signing/signer';

let remoteSignerClient: RemoteSignerClient | undefined;

export async function establishBunkerConnection(bunker: string): Promise<void> {
	const bunkerPointer = await parseBunkerInput(bunker);
	if (!bunkerPointer) throw new Error(`Failed to parse bunker URL`);

	const storage = new WebStorage(localStorage);
	const clientSecretKeyHex = storage.get('login:bunker:client-seckey');
	let clientSecretKey: Uint8Array;
	if (clientSecretKeyHex) {
		clientSecretKey = hexToBytes(clientSecretKeyHex);
	} else {
		clientSecretKey = generateSecretKey();
		storage.set('login:bunker:client-seckey', bytesToHex(clientSecretKey));
	}

	console.debug('[NIP-46 client pubkey]', getPublicKey(clientSecretKey));
	const client = await RemoteSignerClient.connect(bunkerPointer, clientSecretKey, {
		onAuth: (url) => open(url, '_blank'),
		timeoutMs: nip46ConnectTimeout
	});
	const previousClient = remoteSignerClient;
	remoteSignerClient = client;
	if (previousClient) {
		try {
			await previousClient.close();
		} catch (error) {
			console.debug('[NIP-46] close error', error);
		}
	}
	console.debug('[NIP-46 connected]');
}

export async function abolishBunkerConnection(): Promise<void> {
	const client = remoteSignerClient;
	remoteSignerClient = undefined;
	if (client) {
		try {
			await client.close();
		} catch (e) {
			console.debug('[NIP-46] close error', e);
		}
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
		if (remoteSignerClient === undefined) {
			throw new Error('[logic error]');
		}
		return remoteSignerClient;
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
