import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { nip46AuthTimeout, nip46ConnectTimeout } from './Constants';
import {
	abolishBunkerConnection,
	establishBunkerConnection,
	resolveSigner
} from './signer-strategy';
import { signerCanSign } from './signer-capability';

const nip46Mock = vi.hoisted(() => {
	type MockSigner = {
		onauth: ((url: string) => void) | undefined;
		connect: ReturnType<typeof vi.fn>;
		getPublicKey: ReturnType<typeof vi.fn>;
		close: ReturnType<typeof vi.fn>;
		connectResolve: (() => void) | undefined;
		connectReject: ((error: Error) => void) | undefined;
		getPublicKeyResolve: ((pubkey: string) => void) | undefined;
		getPublicKeyReject: ((error: Error) => void) | undefined;
	};
	const signers: MockSigner[] = [];

	const getSigner = (index = signers.length - 1) => {
		const signer = signers[index];
		if (!signer) {
			throw new Error(`missing signer at index ${index}`);
		}
		return signer;
	};

	return {
		fromBunker: vi.fn((...args: unknown[]) => {
			const options = args[2] as { onauth?: (url: string) => void };
			const signer: MockSigner = {
				onauth: options.onauth,
				connect: vi.fn(),
				getPublicKey: vi.fn(),
				close: vi.fn(),
				connectResolve: undefined,
				connectReject: undefined,
				getPublicKeyResolve: undefined,
				getPublicKeyReject: undefined
			};
			signer.connect = vi.fn(
				() =>
					new Promise<void>((resolve, reject) => {
						signer.connectResolve = resolve;
						signer.connectReject = reject;
					})
			);
			signer.getPublicKey = vi.fn(
				() =>
					new Promise<string>((resolve, reject) => {
						signer.getPublicKeyResolve = resolve;
						signer.getPublicKeyReject = reject;
					})
			);
			signers.push(signer);
			return signer;
		}),
		parseBunkerInput: vi.fn(async () => ({
			pubkey: 'pubkey',
			relays: ['wss://relay.example.com']
		})),
		auth: (index = signers.length - 1, url = 'https://auth.example.com') =>
			getSigner(index).onauth?.(url),
		resolveConnect: (index = signers.length - 1) => getSigner(index).connectResolve?.(),
		rejectConnect: (index = signers.length - 1, error = new Error('connect failed')) =>
			getSigner(index).connectReject?.(error),
		resolveGetPublicKey: (index = signers.length - 1, pubkey = 'user-pubkey') =>
			getSigner(index).getPublicKeyResolve?.(pubkey),
		rejectGetPublicKey: (index = signers.length - 1, error = new Error('get pubkey failed')) =>
			getSigner(index).getPublicKeyReject?.(error),
		signer: getSigner,
		signers: () => signers,
		reset: () => {
			signers.length = 0;
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

afterEach(async () => {
	await abolishBunkerConnection();
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
	const flush = async () => {
		await vi.advanceTimersByTimeAsync(0);
	};

	it('rejects on connection timeout when auth challenge is not requested', async () => {
		vi.useFakeTimers();
		stubBunkerStorage();

		const promise = establishBunkerConnection('bunker://relay.example.com?pubkey=abc');
		promise.catch(() => {});
		await flush();
		await vi.advanceTimersByTimeAsync(nip46ConnectTimeout);

		await expect(promise).rejects.toThrow('NIP-46 connection timed out');
		expect(vi.getTimerCount()).toBe(0);
		expect(nip46Mock.signer(0).close).toHaveBeenCalledTimes(1);
	});

	it('does not settle at the connection timeout after an auth challenge', async () => {
		vi.useFakeTimers();
		stubBunkerStorage();

		const promise = establishBunkerConnection('bunker://relay.example.com?pubkey=abc');
		promise.catch(() => {});
		let settled = false;
		void promise.then(
			() => {
				settled = true;
			},
			() => {
				settled = true;
			}
		);
		await flush();
		nip46Mock.auth(0);

		await vi.advanceTimersByTimeAsync(nip46ConnectTimeout);
		expect(settled).toBe(false);

		await vi.advanceTimersByTimeAsync(nip46AuthTimeout - nip46ConnectTimeout);
		await expect(promise).rejects.toThrow('NIP-46 authentication timed out');
		expect(vi.getTimerCount()).toBe(0);
	});

	it('resolves and clears timers when auth challenge is followed by a completed connection', async () => {
		vi.useFakeTimers();
		stubBunkerStorage();

		const promise = establishBunkerConnection('bunker://relay.example.com?pubkey=abc');
		await flush();
		nip46Mock.auth(0);
		await vi.advanceTimersByTimeAsync(nip46AuthTimeout - 1);
		nip46Mock.resolveConnect(0);
		await flush();
		nip46Mock.resolveGetPublicKey(0);

		await expect(promise).resolves.toBeUndefined();
		expect(vi.getTimerCount()).toBe(0);
	});

	it('opens auth challenges after a successful login without starting login timers', async () => {
		vi.useFakeTimers();
		stubBunkerStorage();

		const promise = establishBunkerConnection('bunker://relay.example.com?pubkey=abc');
		await flush();
		nip46Mock.resolveConnect(0);
		await flush();
		nip46Mock.resolveGetPublicKey(0);
		await expect(promise).resolves.toBeUndefined();

		vi.mocked(open).mockClear();
		nip46Mock.auth(0, 'https://auth.example.com/post-login');
		expect(open).toHaveBeenCalledWith('https://auth.example.com/post-login', '_blank');
		expect(vi.getTimerCount()).toBe(0);
	});

	it('ignores delayed auth challenge callbacks after connection timeout', async () => {
		vi.useFakeTimers();
		stubBunkerStorage();

		const promise = establishBunkerConnection('bunker://relay.example.com?pubkey=abc');
		promise.catch(() => {});
		await flush();
		await vi.advanceTimersByTimeAsync(nip46ConnectTimeout);
		await expect(promise).rejects.toThrow('NIP-46 connection timed out');

		nip46Mock.auth(0);
		expect(open).not.toHaveBeenCalled();
		expect(vi.getTimerCount()).toBe(0);
	});

	it('ignores delayed auth challenge callbacks after auth timeout', async () => {
		vi.useFakeTimers();
		stubBunkerStorage();

		const promise = establishBunkerConnection('bunker://relay.example.com?pubkey=abc');
		promise.catch(() => {});
		await flush();
		nip46Mock.auth(0, 'https://auth.example.com/first');
		await vi.advanceTimersByTimeAsync(nip46AuthTimeout);
		await expect(promise).rejects.toThrow('NIP-46 authentication timed out');
		vi.mocked(open).mockClear();

		nip46Mock.auth(0, 'https://auth.example.com/late');
		expect(open).not.toHaveBeenCalled();
		expect(vi.getTimerCount()).toBe(0);
	});

	it('opens multiple auth challenges in a phase without extending the auth deadline', async () => {
		vi.useFakeTimers();
		stubBunkerStorage();

		const promise = establishBunkerConnection('bunker://relay.example.com?pubkey=abc');
		promise.catch(() => {});
		await flush();
		nip46Mock.auth(0, 'https://auth.example.com/first');
		await vi.advanceTimersByTimeAsync(nip46AuthTimeout - 1);
		nip46Mock.auth(0, 'https://auth.example.com/second');

		expect(open).toHaveBeenCalledWith('https://auth.example.com/first', '_blank');
		expect(open).toHaveBeenCalledWith('https://auth.example.com/second', '_blank');
		await vi.advanceTimersByTimeAsync(1);
		await expect(promise).rejects.toThrow('NIP-46 authentication timed out');
		expect(vi.getTimerCount()).toBe(0);
	});

	it('does not let the connect auth timer reject getPublicKey after connect succeeds', async () => {
		vi.useFakeTimers();
		stubBunkerStorage();

		const promise = establishBunkerConnection('bunker://relay.example.com?pubkey=abc');
		let settled = false;
		void promise.then(
			() => {
				settled = true;
			},
			() => {
				settled = true;
			}
		);
		await flush();
		nip46Mock.auth(0);
		await vi.advanceTimersByTimeAsync(nip46AuthTimeout - 1);
		nip46Mock.resolveConnect(0);
		await flush();
		expect(nip46Mock.signer(0).getPublicKey).toHaveBeenCalledTimes(1);

		await vi.advanceTimersByTimeAsync(1);
		expect(settled).toBe(false);
		nip46Mock.resolveGetPublicKey(0);
		await expect(promise).resolves.toBeUndefined();
		expect(vi.getTimerCount()).toBe(0);
	});

	it('rejects when getPublicKey does not respond before its connection timeout', async () => {
		vi.useFakeTimers();
		stubBunkerStorage();

		const promise = establishBunkerConnection('bunker://relay.example.com?pubkey=abc');
		promise.catch(() => {});
		await flush();
		nip46Mock.resolveConnect(0);
		await flush();
		expect(nip46Mock.signer(0).getPublicKey).toHaveBeenCalledTimes(1);

		await vi.advanceTimersByTimeAsync(nip46ConnectTimeout);
		await expect(promise).rejects.toThrow('NIP-46 connection timed out');
		expect(vi.getTimerCount()).toBe(0);
	});

	it('uses an independent auth timeout for getPublicKey auth challenges', async () => {
		vi.useFakeTimers();
		stubBunkerStorage();

		const promise = establishBunkerConnection('bunker://relay.example.com?pubkey=abc');
		await flush();
		nip46Mock.resolveConnect(0);
		await flush();
		nip46Mock.auth(0, 'https://auth.example.com/get-pubkey');
		await vi.advanceTimersByTimeAsync(nip46AuthTimeout - 1);
		nip46Mock.resolveGetPublicKey(0, 'user-pubkey');

		await expect(promise).resolves.toBeUndefined();
		expect(open).toHaveBeenCalledWith('https://auth.example.com/get-pubkey', '_blank');
		expect(vi.getTimerCount()).toBe(0);
	});

	it('rejects when getPublicKey auth challenge is not completed before auth timeout', async () => {
		vi.useFakeTimers();
		stubBunkerStorage();

		const promise = establishBunkerConnection('bunker://relay.example.com?pubkey=abc');
		promise.catch(() => {});
		await flush();
		nip46Mock.resolveConnect(0);
		await flush();
		nip46Mock.auth(0, 'https://auth.example.com/get-pubkey');

		await vi.advanceTimersByTimeAsync(nip46AuthTimeout);
		await expect(promise).rejects.toThrow('NIP-46 authentication timed out');
		expect(vi.getTimerCount()).toBe(0);
	});

	it('does not overwrite the current public key when an old timed-out attempt completes late', async () => {
		vi.useFakeTimers();
		stubBunkerStorage();

		const first = establishBunkerConnection('bunker://relay.example.com?pubkey=abc');
		first.catch(() => {});
		await flush();
		nip46Mock.auth(0);
		await vi.advanceTimersByTimeAsync(nip46AuthTimeout);
		await expect(first).rejects.toThrow('NIP-46 authentication timed out');

		const second = establishBunkerConnection('bunker://relay.example.com?pubkey=abc');
		await flush();
		nip46Mock.resolveConnect(1);
		await flush();
		nip46Mock.resolveGetPublicKey(1, 'second-pubkey');
		await expect(second).resolves.toBeUndefined();

		nip46Mock.resolveConnect(0);
		await flush();
		nip46Mock.resolveGetPublicKey(0, 'first-pubkey');
		await flush();

		stubLogin('bunker://relay.example.com?pubkey=abc');
		const signer = resolveSigner();
		await expect(signer.getPublicKey()).resolves.toBe('second-pubkey');
	});

	it('does not let an old connection attempt destroy the current signer', async () => {
		vi.useFakeTimers();
		stubBunkerStorage();

		const first = establishBunkerConnection('bunker://relay.example.com?pubkey=abc');
		first.catch(() => {});
		await flush();
		await vi.advanceTimersByTimeAsync(nip46ConnectTimeout);
		await expect(first).rejects.toThrow('NIP-46 connection timed out');

		const second = establishBunkerConnection('bunker://relay.example.com?pubkey=abc');
		await flush();
		nip46Mock.resolveConnect(1);
		await flush();
		nip46Mock.resolveGetPublicKey(1, 'second-pubkey');
		await expect(second).resolves.toBeUndefined();

		nip46Mock.resolveConnect(0);
		await flush();
		nip46Mock.resolveGetPublicKey(0, 'first-pubkey');
		await flush();

		stubLogin('bunker://relay.example.com?pubkey=abc');
		await expect(resolveSigner().getPublicKey()).resolves.toBe('second-pubkey');
		nip46Mock.auth(1, 'https://auth.example.com/current');
		expect(open).toHaveBeenCalledWith('https://auth.example.com/current', '_blank');
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
