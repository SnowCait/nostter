import { BunkerSigner, type BunkerPointer } from 'nostr-tools/nip46';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RemoteSignerClient } from './remote-signer-client';

vi.mock('nostr-tools/nip46', () => ({
	BunkerSigner: { fromBunker: vi.fn() }
}));

const bunkerPointer: BunkerPointer = {
	pubkey: 'remote',
	relays: ['wss://relay.example.com'],
	secret: null
};
const clientSecretKey = new Uint8Array(32).fill(1);
const onAuth = vi.fn();

function createConnection() {
	return {
		connect: vi.fn().mockResolvedValue(undefined),
		getPublicKey: vi.fn().mockResolvedValue('user'),
		signEvent: vi.fn().mockResolvedValue({ id: 'event' }),
		nip04Encrypt: vi.fn().mockResolvedValue('nip04-ciphertext'),
		nip04Decrypt: vi.fn().mockResolvedValue('nip04-plaintext'),
		nip44Encrypt: vi.fn().mockResolvedValue('nip44-ciphertext'),
		nip44Decrypt: vi.fn().mockResolvedValue('nip44-plaintext'),
		close: vi.fn().mockResolvedValue(undefined)
	};
}

let connection: ReturnType<typeof createConnection>;

beforeEach(() => {
	connection = createConnection();
	vi.mocked(BunkerSigner.fromBunker).mockReturnValue(connection as unknown as BunkerSigner);
});

afterEach(() => {
	vi.useRealTimers();
	vi.clearAllMocks();
});

const connectClient = () =>
	RemoteSignerClient.connect(bunkerPointer, clientSecretKey, { onAuth, timeoutMs: 1000 });

describe('RemoteSignerClient', () => {
	it('waits for connect and the user public key before returning a signer', async () => {
		const connected = Promise.withResolvers<void>();
		const publicKey = Promise.withResolvers<string>();
		connection.connect.mockReturnValue(connected.promise);
		connection.getPublicKey.mockReturnValue(publicKey.promise);

		const connecting = connectClient();
		expect(BunkerSigner.fromBunker).toHaveBeenCalledWith(
			clientSecretKey,
			bunkerPointer,
			expect.objectContaining({ onauth: expect.any(Function) })
		);
		expect(connection.connect).toHaveBeenCalledOnce();
		expect(connection.getPublicKey).not.toHaveBeenCalled();

		connected.resolve();
		await vi.waitFor(() => expect(connection.getPublicKey).toHaveBeenCalledOnce());
		let returned = false;
		void connecting.then(() => (returned = true));
		await Promise.resolve();
		expect(returned).toBe(false);

		publicKey.resolve('user');
		await expect(connecting).resolves.toBeInstanceOf(RemoteSignerClient);
	});

	it('delegates signer operations, encryption capabilities, and close to its connection', async () => {
		const client = await connectClient();
		const unsignedEvent = { created_at: 1, kind: 1, tags: [], content: '' };

		await expect(client.getPublicKey()).resolves.toBe('user');
		await expect(client.signEvent(unsignedEvent)).resolves.toEqual({ id: 'event' });
		await expect(client.nip04.encrypt('peer', 'plain')).resolves.toBe('nip04-ciphertext');
		await expect(client.nip04.decrypt('peer', 'cipher')).resolves.toBe('nip04-plaintext');
		await expect(client.nip44.encrypt('peer', 'plain')).resolves.toBe('nip44-ciphertext');
		await expect(client.nip44.decrypt('peer', 'cipher')).resolves.toBe('nip44-plaintext');
		await client.close();

		expect(connection.signEvent).toHaveBeenCalledWith(unsignedEvent);
		expect(connection.nip04Encrypt).toHaveBeenCalledWith('peer', 'plain');
		expect(connection.nip04Decrypt).toHaveBeenCalledWith('peer', 'cipher');
		expect(connection.nip44Encrypt).toHaveBeenCalledWith('peer', 'plain');
		expect(connection.nip44Decrypt).toHaveBeenCalledWith('peer', 'cipher');
		expect(connection.close).toHaveBeenCalledOnce();
	});

	it.each(['connect', 'getPublicKey'] as const)(
		'closes the connection when %s fails',
		async (step) => {
			connection[step].mockRejectedValue(new Error(`${step} failed`));

			await expect(connectClient()).rejects.toThrow(`${step} failed`);
			expect(connection.close).toHaveBeenCalledOnce();
		}
	);

	it('times out and closes when no auth request occurs', async () => {
		vi.useFakeTimers();
		connection.connect.mockReturnValue(new Promise(() => {}));

		const connecting = connectClient();
		const failure = expect(connecting).rejects.toThrow('NIP-46 connection timed out');
		await vi.advanceTimersByTimeAsync(1000);
		await failure;
		expect(connection.close).toHaveBeenCalledOnce();
	});

	it('passes auth requests to the caller without timing out', async () => {
		vi.useFakeTimers();
		const connected = Promise.withResolvers<void>();
		connection.connect.mockReturnValue(connected.promise);

		const connecting = connectClient();
		const onauth = vi.mocked(BunkerSigner.fromBunker).mock.calls[0][2]?.onauth;
		onauth?.('https://example.com/auth');
		expect(onAuth).toHaveBeenCalledWith('https://example.com/auth');

		await vi.advanceTimersByTimeAsync(1000);
		expect(connection.close).not.toHaveBeenCalled();
		connected.resolve();
		await expect(connecting).resolves.toBeInstanceOf(RemoteSignerClient);
	});
});
