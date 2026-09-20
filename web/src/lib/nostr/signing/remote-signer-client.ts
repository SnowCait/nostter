import type { Event, EventTemplate } from 'nostr-tools';
import { BunkerSigner, type BunkerPointer } from 'nostr-tools/nip46';
import type * as Nostr from 'nostr-typedef';
import type { Encryption, Signer } from './signer';

type ConnectOptions = {
	onAuth: (url: string) => void;
	timeoutMs: number;
};

export class RemoteSignerClient implements Signer {
	private constructor(private readonly connection: BunkerSigner) {}

	readonly nip04: Encryption = {
		encrypt: (pubkey, plaintext) => this.connection.nip04Encrypt(pubkey, plaintext),
		decrypt: (pubkey, ciphertext) => this.connection.nip04Decrypt(pubkey, ciphertext)
	};

	readonly nip44: Encryption = {
		encrypt: (pubkey, plaintext) => this.connection.nip44Encrypt(pubkey, plaintext),
		decrypt: (pubkey, ciphertext) => this.connection.nip44Decrypt(pubkey, ciphertext)
	};

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
}
