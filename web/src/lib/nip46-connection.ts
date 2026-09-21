import { getPublicKey } from 'nostr-tools';
import { parseBunkerInput } from 'nostr-tools/nip46';
import { generateSecretKey } from 'nostr-tools/pure';
import { bytesToHex, hexToBytes } from 'nostr-tools/utils';
import { WebStorage } from './WebStorage';
import { nip46ConnectTimeout } from './Constants';
import { RemoteSignerClient } from './nostr/signing/remote-signer-client';

export async function establishBunkerConnection(bunker: string): Promise<RemoteSignerClient> {
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
	console.debug('[NIP-46 connected]');
	return client;
}
