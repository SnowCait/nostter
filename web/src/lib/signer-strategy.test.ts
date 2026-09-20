import { describe, it, expect, vi, afterEach } from 'vitest';
import { generateSecretKey, nip19 } from 'nostr-tools';
import { parseBunkerInput, type BunkerPointer } from 'nostr-tools/nip46';
import { RemoteSignerClient } from './nostr/signing/remote-signer-client';
import {
	abolishBunkerConnection,
	establishBunkerConnection,
	resolveSigner
} from './signer-strategy';

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

function stubLogin(value: string | null): void {
	vi.stubGlobal('localStorage', {
		getItem: (key: string) => (key === 'nostter:login' ? value : null),
		setItem: () => {},
		removeItem: () => {},
		clear: () => {}
	});
}

afterEach(async () => {
	await abolishBunkerConnection();
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

describe('resolveSigner', () => {
	it('accepts NIP-07 as a signer login', () => {
		stubLogin('NIP-07');
		expect(() => resolveSigner()).not.toThrow();
	});

	it('resolves a bunker login only while its remote client is connected', async () => {
		stubLogin(bunkerLogin);
		expect(() => resolveSigner()).toThrow('[logic error]');
		vi.mocked(parseBunkerInput).mockResolvedValue(bunkerPointer);
		const client = {
			close: vi.fn().mockResolvedValue(undefined)
		} as unknown as RemoteSignerClient;
		const connecting = Promise.withResolvers<RemoteSignerClient>();
		vi.mocked(RemoteSignerClient.connect).mockReturnValue(connecting.promise);

		const establishing = establishBunkerConnection(bunkerLogin);
		await vi.waitFor(() => expect(RemoteSignerClient.connect).toHaveBeenCalledOnce());
		expect(() => resolveSigner()).toThrow('[logic error]');
		connecting.resolve(client);
		await establishing;
		expect(resolveSigner()).toBe(client);

		await abolishBunkerConnection();
		expect(() => resolveSigner()).toThrow('[logic error]');
		expect(client.close).toHaveBeenCalledOnce();
	});

	it('keeps a failed connection unavailable', async () => {
		stubLogin(bunkerLogin);
		vi.mocked(parseBunkerInput).mockResolvedValue(bunkerPointer);
		vi.mocked(RemoteSignerClient.connect).mockRejectedValue(new Error('connection failed'));

		await expect(establishBunkerConnection(bunkerLogin)).rejects.toThrow('connection failed');
		expect(() => resolveSigner()).toThrow('[logic error]');
	});

	it('closes the previous client when a new connection becomes active', async () => {
		stubLogin(bunkerLogin);
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
		await establishBunkerConnection(bunkerLogin);
		expect(first.close).toHaveBeenCalledOnce();
		expect(resolveSigner()).toBe(second);
	});

	it('clears the active client even when closing fails', async () => {
		stubLogin(bunkerLogin);
		vi.mocked(parseBunkerInput).mockResolvedValue(bunkerPointer);
		const client = {
			close: vi.fn().mockRejectedValue(new Error('close failed'))
		} as unknown as RemoteSignerClient;
		vi.mocked(RemoteSignerClient.connect).mockResolvedValue(client);

		await establishBunkerConnection(bunkerLogin);
		await abolishBunkerConnection();
		expect(() => resolveSigner()).toThrow('[logic error]');
	});

	it('detaches the active client before closing it completes', async () => {
		stubLogin(bunkerLogin);
		vi.mocked(parseBunkerInput).mockResolvedValue(bunkerPointer);
		const close = Promise.withResolvers<void>();
		const client = {
			close: vi.fn().mockReturnValue(close.promise)
		} as unknown as RemoteSignerClient;
		vi.mocked(RemoteSignerClient.connect).mockResolvedValue(client);

		await establishBunkerConnection(bunkerLogin);
		const disposing = abolishBunkerConnection();

		expect(client.close).toHaveBeenCalledOnce();
		expect(() => resolveSigner()).toThrow('[logic error]');

		close.resolve();
		await disposing;
	});

	it('accepts nsec as a signer login', () => {
		stubLogin(nip19.nsecEncode(generateSecretKey()));
		expect(() => resolveSigner()).not.toThrow();
	});

	it('throws when nsec is malformed', () => {
		stubLogin('nsec1abc');
		expect(() => resolveSigner()).toThrow();
	});

	it('throws when login is npub because no signer is available', () => {
		stubLogin('npub1abc');
		expect(() => resolveSigner()).toThrow('[logic error]');
	});

	it('throws when login is missing', () => {
		stubLogin(null);
		expect(() => resolveSigner()).toThrow('[logic error]');
	});

	it('throws on unknown login', () => {
		stubLogin('garbage');
		expect(() => resolveSigner()).toThrow('[logic error]');
	});
});
