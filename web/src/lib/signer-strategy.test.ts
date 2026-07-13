import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { nip46AuthTimeout, nip46ConnectTimeout } from './Constants';
import { establishBunkerConnection, resolveSigner } from './signer-strategy';
import { signerCanSign } from './signer-capability';

const nip46Mock = vi.hoisted(() => {
	let onauth: ((url: string) => void) | undefined;
	let connectResolve: (() => void) | undefined;
	let getPublicKeyResolve: ((pubkey: string) => void) | undefined;

	return {
		fromBunker: vi.fn((...args: unknown[]) => {
			const options = args[2] as { onauth?: (url: string) => void };
			onauth = options.onauth;
			return {
				connect: vi.fn(
					() =>
						new Promise<void>((resolve) => {
							connectResolve = resolve;
						})
				),
				getPublicKey: vi.fn(
					() =>
						new Promise<string>((resolve) => {
							getPublicKeyResolve = resolve;
						})
				),
				close: vi.fn()
			};
		}),
		parseBunkerInput: vi.fn(async () => ({
			pubkey: 'pubkey',
			relays: ['wss://relay.example.com']
		})),
		auth: (url = 'https://auth.example.com') => onauth?.(url),
		resolveConnect: () => connectResolve?.(),
		resolveGetPublicKey: (pubkey = 'user-pubkey') => getPublicKeyResolve?.(pubkey),
		reset: () => {
			onauth = undefined;
			connectResolve = undefined;
			getPublicKeyResolve = undefined;
		}
	};
});

vi.mock('nostr-tools/nip46', () => ({
	BunkerSigner: {
		fromBunker: nip46Mock.fromBunker
	},
	parseBunkerInput: nip46Mock.parseBunkerInput
}));

function stubLogin(value: string | null): void {
	vi.stubGlobal('localStorage', {
		getItem: (key: string) => (key === 'nostter:login' ? value : null),
		setItem: () => {},
		removeItem: () => {},
		clear: () => {}
	});
}

function stubBunkerStorage(): void {
	vi.stubGlobal('localStorage', {
		getItem: () => null,
		setItem: () => {},
		removeItem: () => {},
		clear: () => {}
	});
}

beforeEach(() => {
	nip46Mock.reset();
	nip46Mock.fromBunker.mockClear();
	nip46Mock.parseBunkerInput.mockClear();
	vi.stubGlobal('open', vi.fn());
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe('signerCanSign', () => {
	it('returns true for signing capable types', () => {
		expect(signerCanSign('NIP-07')).toBe(true);
		expect(signerCanSign('NIP-46')).toBe(true);
		expect(signerCanSign('nsec')).toBe(true);
	});

	it('returns false for npub and undefined', () => {
		expect(signerCanSign('npub')).toBe(false);
		expect(signerCanSign(undefined)).toBe(false);
	});
});

describe('establishBunkerConnection', () => {
	it('rejects on connection timeout when auth challenge is not requested', async () => {
		vi.useFakeTimers();
		stubBunkerStorage();

		const promise = establishBunkerConnection('bunker://relay.example.com?pubkey=abc');
		promise.catch(() => {});
		await vi.advanceTimersByTimeAsync(nip46ConnectTimeout);

		await expect(promise).rejects.toThrow('NIP-46 connection timed out');
		expect(vi.getTimerCount()).toBe(0);
	});

	it('rejects on auth timeout after an auth challenge without using the connection timeout', async () => {
		vi.useFakeTimers();
		stubBunkerStorage();

		const promise = establishBunkerConnection('bunker://relay.example.com?pubkey=abc');
		promise.catch(() => {});
		await vi.advanceTimersByTimeAsync(0);
		nip46Mock.auth();

		await vi.advanceTimersByTimeAsync(nip46ConnectTimeout);
		await expect(
			Promise.race([
				promise.then(
					() => 'resolved',
					() => 'rejected'
				),
				Promise.resolve('pending')
			])
		).resolves.toBe('pending');

		await vi.advanceTimersByTimeAsync(nip46AuthTimeout - nip46ConnectTimeout);
		await expect(promise).rejects.toThrow('NIP-46 authentication timed out');
		expect(vi.getTimerCount()).toBe(0);
	});

	it('resolves and clears timers when auth challenge is followed by a completed connection', async () => {
		vi.useFakeTimers();
		stubBunkerStorage();

		const promise = establishBunkerConnection('bunker://relay.example.com?pubkey=abc');
		await vi.advanceTimersByTimeAsync(0);
		nip46Mock.auth();
		await vi.advanceTimersByTimeAsync(nip46AuthTimeout - 1);
		nip46Mock.resolveConnect();
		await vi.advanceTimersByTimeAsync(0);
		nip46Mock.resolveGetPublicKey();

		await expect(promise).resolves.toBeUndefined();
		expect(vi.getTimerCount()).toBe(0);
	});

	it('ignores delayed auth challenge callbacks after connection attempt is settled', async () => {
		vi.useFakeTimers();
		stubBunkerStorage();

		const promise = establishBunkerConnection('bunker://relay.example.com?pubkey=abc');
		await vi.advanceTimersByTimeAsync(0);
		nip46Mock.resolveConnect();
		await vi.advanceTimersByTimeAsync(0);
		nip46Mock.resolveGetPublicKey();
		await expect(promise).resolves.toBeUndefined();

		nip46Mock.auth();
		expect(open).not.toHaveBeenCalled();
		expect(vi.getTimerCount()).toBe(0);
	});
});

describe('resolveSigner', () => {
	it('resolves NIP-07', () => {
		stubLogin('NIP-07');
		const signer = resolveSigner();
		expect(signer.type).toBe('NIP-07');
		expect(signer.canSign).toBe(true);
	});

	it('resolves NIP-46 from bunker URL', () => {
		stubLogin('bunker://relay.example.com?pubkey=abc');
		const signer = resolveSigner();
		expect(signer.type).toBe('NIP-46');
		expect(signer.canSign).toBe(true);
	});

	it('resolves nsec', () => {
		stubLogin('nsec1abc');
		const signer = resolveSigner();
		expect(signer.type).toBe('nsec');
		expect(signer.canSign).toBe(true);
	});

	it('resolves npub as read-only', () => {
		stubLogin('npub1abc');
		const signer = resolveSigner();
		expect(signer.type).toBe('npub');
		expect(signer.canSign).toBe(false);
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
