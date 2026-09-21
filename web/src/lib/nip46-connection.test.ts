import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseBunkerInput, type BunkerPointer } from 'nostr-tools/nip46';
import { RemoteSignerClient } from './nostr/signing/remote-signer-client';
import { abolishBunkerConnection, establishBunkerConnection } from './nip46-connection';

vi.mock('nostr-tools/nip46', () => ({ parseBunkerInput: vi.fn() }));
vi.mock('./nostr/signing/remote-signer-client', () => ({
	RemoteSignerClient: { connect: vi.fn() }
}));

const bunkerLogin = 'bunker://remote?relay=wss://relay.example.com';
const bunkerPointer: BunkerPointer = {
	pubkey: 'remote',
	relays: ['wss://relay.example.com'],
	secret: null
};

afterEach(async () => {
	await abolishBunkerConnection();
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

function stubStorage(): void {
	vi.stubGlobal('localStorage', {
		getItem: vi.fn().mockReturnValue(null),
		setItem: vi.fn(),
		removeItem: vi.fn(),
		clear: vi.fn()
	});
}

describe('NIP-46 connection', () => {
	it('returns the connected remote signer client and closes it on teardown', async () => {
		stubStorage();
		vi.mocked(parseBunkerInput).mockResolvedValue(bunkerPointer);
		const client = {
			close: vi.fn().mockResolvedValue(undefined)
		} as unknown as RemoteSignerClient;
		vi.mocked(RemoteSignerClient.connect).mockResolvedValue(client);

		await expect(establishBunkerConnection(bunkerLogin)).resolves.toBe(client);
		await abolishBunkerConnection();

		expect(client.close).toHaveBeenCalledOnce();
	});

	it('keeps a failed connection out of connection teardown', async () => {
		stubStorage();
		vi.mocked(parseBunkerInput).mockResolvedValue(bunkerPointer);
		vi.mocked(RemoteSignerClient.connect).mockRejectedValue(new Error('connection failed'));

		await expect(establishBunkerConnection(bunkerLogin)).rejects.toThrow('connection failed');
		await expect(abolishBunkerConnection()).resolves.toBeUndefined();
	});

	it('closes the previous client when a new connection becomes current', async () => {
		stubStorage();
		vi.mocked(parseBunkerInput).mockResolvedValue(bunkerPointer);
		const first = {
			close: vi.fn().mockResolvedValue(undefined)
		} as unknown as RemoteSignerClient;
		const second = {
			close: vi.fn().mockResolvedValue(undefined)
		} as unknown as RemoteSignerClient;
		vi.mocked(RemoteSignerClient.connect)
			.mockResolvedValueOnce(first)
			.mockResolvedValueOnce(second);

		await establishBunkerConnection(bunkerLogin);
		await expect(establishBunkerConnection(bunkerLogin)).resolves.toBe(second);

		expect(first.close).toHaveBeenCalledOnce();
	});

	it('detaches the client before its close completes', async () => {
		stubStorage();
		vi.mocked(parseBunkerInput).mockResolvedValue(bunkerPointer);
		const close = Promise.withResolvers<void>();
		const client = {
			close: vi.fn().mockReturnValue(close.promise)
		} as unknown as RemoteSignerClient;
		vi.mocked(RemoteSignerClient.connect).mockResolvedValue(client);
		await establishBunkerConnection(bunkerLogin);

		const disposing = abolishBunkerConnection();
		await expect(abolishBunkerConnection()).resolves.toBeUndefined();
		expect(client.close).toHaveBeenCalledOnce();

		close.resolve();
		await disposing;
	});
});
