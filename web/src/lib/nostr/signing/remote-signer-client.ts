import type { Event, EventTemplate } from 'nostr-tools';
import { BunkerSigner, type BunkerPointer } from 'nostr-tools/nip46';
import type * as Nostr from 'nostr-typedef';
import type { Signer } from './signer';

type ConnectOptions = {
	onAuth: (url: string) => void;
	timeoutMs: number;
};

export class RemoteSignerClient implements Signer {
	private constructor(private readonly connection: BunkerSigner) {}

	static async connect(
		bunkerPointer: BunkerPointer,
		clientSecretKey: Uint8Array,
		{ onAuth, timeoutMs }: ConnectOptions
	): Promise<RemoteSignerClient> {
		let authRequested = false;
		const connection = BunkerSigner.fromBunker(clientSecretKey, bunkerPointer, {
			onauth: (url) => {
				authRequested = true;
				onAuth(url);
			}
		});
		const { promise: timeout, reject: rejectOnTimeout } = Promise.withResolvers<never>();
		const timer = setTimeout(() => {
			if (!authRequested) {
				rejectOnTimeout(new Error('NIP-46 connection timed out'));
			}
		}, timeoutMs);

		try {
			await Promise.race([
				(async () => {
					await connection.connect();
					await connection.getPublicKey();
				})(),
				timeout
			]);
			return new RemoteSignerClient(connection);
		} catch (error) {
			try {
				await connection.close();
			} catch (closeError) {
				console.debug('[NIP-46] close error', closeError);
			}
			throw error;
		} finally {
			clearTimeout(timer);
		}
	}

	async close(): Promise<void> {
		await this.connection.close();
	}

	async getPublicKey(): Promise<string> {
		return await this.connection.getPublicKey();
	}

	async signEvent(unsignedEvent: EventTemplate | Nostr.UnsignedEvent): Promise<Event> {
		return await this.connection.signEvent(unsignedEvent);
	}

	async encrypt(pubkey: string, plaintext: string): Promise<string> {
		return await this.connection.nip04Encrypt(pubkey, plaintext);
	}

	async decrypt(pubkey: string, ciphertext: string): Promise<string> {
		return await this.connection.nip04Decrypt(pubkey, ciphertext);
	}

	async encryptNip44(pubkey: string, plaintext: string): Promise<string> {
		return await this.connection.nip44Encrypt(pubkey, plaintext);
	}

	async decryptNip44(pubkey: string, ciphertext: string): Promise<string> {
		return await this.connection.nip44Decrypt(pubkey, ciphertext);
	}
}
