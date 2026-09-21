import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseBunkerInput, type BunkerPointer } from 'nostr-tools/nip46';
import { nip46ConnectTimeout } from './Constants';
import { RemoteSignerClient } from './nostr/signing/remote-signer-client';
import { establishBunkerConnection } from './nip46-connection';

const generateSecretKey = vi.hoisted(() => vi.fn());

vi.mock('nostr-tools/nip46', () => ({ parseBunkerInput: vi.fn() }));
vi.mock('nostr-tools/pure', () => ({ generateSecretKey }));
vi.mock('./nostr/signing/remote-signer-client', () => ({
	RemoteSignerClient: { connect: vi.fn() }
}));

const bunkerLogin = 'bunker://remote?relay=wss://relay.example.com';
const bunkerPointer: BunkerPointer = {
	pubkey: 'remote',
	relays: ['wss://relay.example.com'],
	secret: null
};

afterEach(() => {
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

function stubStorage(storedClientSecretKey: string | null) {
	const storage = {
		getItem: vi.fn().mockReturnValue(storedClientSecretKey),
		setItem: vi.fn(),
		removeItem: vi.fn(),
		clear: vi.fn()
	};
	vi.stubGlobal('localStorage', storage);
	return storage;
}

describe('NIP-46 connection', () => {
	it('returns the connected client using the parsed bunker pointer and persisted client key', async () => {
		const storage = stubStorage('01'.repeat(32));
		const open = vi.fn();
		vi.stubGlobal('open', open);
		vi.mocked(parseBunkerInput).mockResolvedValue(bunkerPointer);
		const client = {} as RemoteSignerClient;
		vi.mocked(RemoteSignerClient.connect).mockResolvedValue(client);

		await expect(establishBunkerConnection(bunkerLogin)).resolves.toBe(client);

		expect(parseBunkerInput).toHaveBeenCalledWith(bunkerLogin);
		expect(storage.getItem).toHaveBeenCalledWith('nostter:login:bunker:client-seckey');
		expect(storage.setItem).not.toHaveBeenCalled();
		expect(RemoteSignerClient.connect).toHaveBeenCalledWith(
			bunkerPointer,
			new Uint8Array(32).fill(1),
			{ onAuth: expect.any(Function), timeoutMs: nip46ConnectTimeout }
		);

		const options = vi.mocked(RemoteSignerClient.connect).mock.calls[0]?.[2];
		options?.onAuth('https://example.com/auth');
		expect(open).toHaveBeenCalledWith('https://example.com/auth', '_blank');
	});

	it('generates and persists a client key before connecting when none exists', async () => {
		const storage = stubStorage(null);
		vi.stubGlobal('open', vi.fn());
		vi.mocked(parseBunkerInput).mockResolvedValue(bunkerPointer);
		const clientSecretKey = new Uint8Array(32).fill(2);
		generateSecretKey.mockReturnValue(clientSecretKey);
		const client = {} as RemoteSignerClient;
		vi.mocked(RemoteSignerClient.connect).mockResolvedValue(client);

		await expect(establishBunkerConnection(bunkerLogin)).resolves.toBe(client);

		expect(storage.setItem).toHaveBeenCalledWith(
			'nostter:login:bunker:client-seckey',
			'02'.repeat(32)
		);
		expect(RemoteSignerClient.connect).toHaveBeenCalledWith(bunkerPointer, clientSecretKey, {
			onAuth: expect.any(Function),
			timeoutMs: nip46ConnectTimeout
		});
	});
});
