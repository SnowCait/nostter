import { get } from 'svelte/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Author } from './Author';
import type { NotificationVisibility } from './preferences/NotificationVisibility.svelte';

const {
	loadFolloweesOfFollowees,
	notificationVisibility,
	fetchEvents,
	fetchRelays,
	loadFolloweesMetadataCache,
	remoteSignerSubscribeIfEnabled,
	storageClear,
	storageGet,
	abolishBunkerConnection,
	establishBunkerConnection,
	browserGetPublicKey,
	privateGetPublicKey,
	browserCapabilities,
	browserSignerInstances,
	privateSignerInstances,
	remoteSigner,
	waitNostr,
	calls
} = vi.hoisted(() => {
	function createStore<T>(initial: T) {
		let value = initial;
		const subscribers = new Set<(value: T) => void>();
		return {
			subscribe(fn: (value: T) => void) {
				fn(value);
				subscribers.add(fn);
				return () => subscribers.delete(fn);
			},
			set(next: T) {
				value = next;
				for (const fn of subscribers) {
					fn(value);
				}
			}
		};
	}

	const browserGetPublicKey = vi.fn();
	const privateGetPublicKey = vi.fn();
	const browserCapabilities: {
		nip04?: { encrypt: ReturnType<typeof vi.fn>; decrypt: ReturnType<typeof vi.fn> };
		nip44?: { encrypt: ReturnType<typeof vi.fn>; decrypt: ReturnType<typeof vi.fn> };
	} = {};
	const browserSignerInstances: object[] = [];
	const privateSignerInstances: Array<{
		secretKey: Uint8Array;
		getPublicKey: ReturnType<typeof vi.fn>;
		nip04: { encrypt: ReturnType<typeof vi.fn>; decrypt: ReturnType<typeof vi.fn> };
		nip44: { encrypt: ReturnType<typeof vi.fn>; decrypt: ReturnType<typeof vi.fn> };
	}> = [];
	const remoteSigner = {
		getPublicKey: vi.fn(),
		signEvent: vi.fn(),
		nip04: { encrypt: vi.fn(), decrypt: vi.fn() },
		nip44: { encrypt: vi.fn(), decrypt: vi.fn() }
	};

	return {
		loadFolloweesOfFollowees: vi.fn(),
		notificationVisibility: createStore<NotificationVisibility>('all'),
		fetchEvents: vi.fn(),
		fetchRelays: vi.fn().mockResolvedValue(undefined),
		loadFolloweesMetadataCache: vi.fn().mockResolvedValue(undefined),
		remoteSignerSubscribeIfEnabled: vi.fn(),
		storageClear: vi.fn(),
		storageGet: vi.fn().mockReturnValue(null),
		abolishBunkerConnection: vi.fn().mockResolvedValue(undefined),
		establishBunkerConnection: vi.fn().mockResolvedValue(remoteSigner),
		browserGetPublicKey,
		privateGetPublicKey,
		browserCapabilities,
		browserSignerInstances,
		privateSignerInstances,
		remoteSigner,
		waitNostr: vi.fn().mockResolvedValue({}),
		calls: [] as string[]
	};
});

vi.mock('./features/notifications/application/followees-of-followees', () => ({
	loadFolloweesOfFollowees
}));

vi.mock('./preferences/NotificationVisibility.svelte', () => ({
	notificationVisibility
}));

vi.mock('./Author', () => ({
	Author: class {
		fetchRelays = fetchRelays;
		fetchEvents = fetchEvents;
	}
}));

vi.mock('./WebStorage', () => ({
	WebStorage: class {
		set = vi.fn();
		get = storageGet;
		clear = storageClear;
	}
}));

vi.mock('./Signer', () => ({
	Signer: {
		abolishBunkerConnection,
		establishBunkerConnection
	}
}));

vi.mock('./nostr/signing/browser-signer', () => ({
	BrowserSigner: class {
		constructor() {
			browserSignerInstances.push(this);
		}

		getPublicKey = browserGetPublicKey;
		signEvent = vi.fn();

		get nip04() {
			return browserCapabilities.nip04;
		}

		get nip44() {
			return browserCapabilities.nip44;
		}
	}
}));

vi.mock('./nostr/signing/private-key-signer', () => ({
	PrivateKeySigner: class {
		getPublicKey = privateGetPublicKey;
		signEvent = vi.fn();
		nip04 = { encrypt: vi.fn(), decrypt: vi.fn() };
		nip44 = { encrypt: vi.fn(), decrypt: vi.fn() };

		constructor(public readonly secretKey: Uint8Array) {
			privateSignerInstances.push(this);
		}
	}
}));

vi.mock('nip07-awaiter', () => ({ waitNostr }));

vi.mock('./timelines/MainTimeline', () => ({
	rxNostr: { getDefaultRelays: vi.fn().mockReturnValue({}), send: vi.fn(), use: vi.fn() }
}));

vi.mock('./cache/Events', () => ({
	loadFolloweesMetadataCache,
	pruneFolloweeReplaceableEventsCache: vi.fn()
}));

vi.mock('./RemoteSigner', () => ({
	remoteSigner: { subscribeIfEnabled: remoteSignerSubscribeIfEnabled }
}));

vi.mock('./stores/LoginStatus', () => ({
	setLoginStatus: vi.fn(),
	clearLoginStatus: vi.fn()
}));

const me = 'f'.repeat(64);
const followee = 'a'.repeat(64);

vi.stubGlobal('localStorage', {
	getItem: vi.fn().mockReturnValue(null),
	setItem: vi.fn(),
	removeItem: vi.fn(),
	clear: vi.fn()
});

beforeEach(async () => {
	const { clearActiveSigner } = await import('./nostr/signing/active-signer');
	clearActiveSigner();
	browserSignerInstances.length = 0;
	privateSignerInstances.length = 0;
	delete browserCapabilities.nip04;
	delete browserCapabilities.nip44;
	browserGetPublicKey.mockResolvedValue(me);
	privateGetPublicKey.mockResolvedValue(me);
	remoteSigner.getPublicKey.mockResolvedValue(me);
	storageGet.mockReturnValue(null);
});

describe('Login.withNpub', () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		vi.restoreAllMocks();
		calls.length = 0;
		notificationVisibility.set('all');

		const { auth } = await import('./auth.svelte');
		auth.reset();

		const originalEstablish = Object.getPrototypeOf(auth).establish.bind(auth);
		vi.spyOn(auth, 'establish').mockImplementation(
			(pubkey: string, followingPubkeys: string[]) => {
				calls.push('establish');
				originalEstablish(pubkey, followingPubkeys);
			}
		);

		loadFolloweesMetadataCache.mockResolvedValue(undefined);
		fetchEvents.mockResolvedValue([['p', followee]]);
		loadFolloweesOfFollowees.mockImplementation(() => {
			calls.push('loadFolloweesOfFollowees');
		});
	});

	it('does not start the loader while notificationVisibility is not follows_of_follows', async () => {
		const { nip19 } = await import('nostr-tools');
		const { Login } = await import('./Login');
		const npub = nip19.npubEncode(me);

		const login = new Login();
		await login.withNpub(npub);

		expect(loadFolloweesOfFollowees).not.toHaveBeenCalled();
	});

	it('starts the loader with the established followees once authenticated', async () => {
		notificationVisibility.set('follows_of_follows');

		const { nip19 } = await import('nostr-tools');
		const { auth } = await import('./auth.svelte');
		const { Login } = await import('./Login');
		const npub = nip19.npubEncode(me);

		const login = new Login();
		await login.withNpub(npub);

		expect(loadFolloweesOfFollowees).toHaveBeenCalledTimes(1);
		expect(loadFolloweesOfFollowees).toHaveBeenCalledWith(auth.followees);
		expect(auth.followees).toContain(followee);
	});

	it('starts the loader only after auth.establish()', async () => {
		notificationVisibility.set('follows_of_follows');

		const { nip19 } = await import('nostr-tools');
		const { Login } = await import('./Login');
		const npub = nip19.npubEncode(me);

		const login = new Login();
		await login.withNpub(npub);

		expect(calls).toEqual(['establish', 'loadFolloweesOfFollowees']);
	});

	it('does not publish pubkey/followingPubkeys/followees/authenticated status to global auth until account initialization completes', async () => {
		let resolveMetadataCache: () => void = () => {};
		loadFolloweesMetadataCache.mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					resolveMetadataCache = resolve;
				})
		);

		const { nip19 } = await import('nostr-tools');
		const { auth } = await import('./auth.svelte');
		const { Login } = await import('./Login');
		const npub = nip19.npubEncode(me);

		const login = new Login();
		const loginPromise = login.withNpub(npub);

		await Promise.resolve();
		await Promise.resolve();

		expect(auth.pubkey).toBeUndefined();
		expect(auth.followingPubkeys).toEqual([]);
		expect(auth.followees).toEqual([]);
		expect(auth.status).not.toBe('authenticated');

		resolveMetadataCache();
		await loginPromise;

		expect(auth.pubkey).toBe(me);
		expect(auth.followingPubkeys).toEqual([followee]);
		expect(auth.followees).toEqual([followee, me]);
		expect(auth.status).toBe('authenticated');
	});

	it('does not start the remote signer for a read-only session', async () => {
		const { nip19 } = await import('nostr-tools');
		const { auth } = await import('./auth.svelte');
		const { Login } = await import('./Login');
		const npub = nip19.npubEncode(me);

		const login = new Login();
		await login.withNpub(npub);

		expect(auth.status).toBe('authenticated');
		expect(remoteSignerSubscribeIfEnabled).not.toHaveBeenCalled();
	});

	it('does not provide a private-list decrypter during initialization', async () => {
		const { nip19 } = await import('nostr-tools');
		const { Login } = await import('./Login');

		await new Login().withNpub(nip19.npubEncode(me));

		expect(fetchEvents).toHaveBeenCalledWith(undefined);
		expect(browserSignerInstances).toHaveLength(0);
		expect(privateSignerInstances).toHaveLength(0);
		expect(establishBunkerConnection).not.toHaveBeenCalled();
	});

	it('clears a stale signer before publishing the read-only session', async () => {
		const { nip19 } = await import('nostr-tools');
		const { getActiveSigner, setActiveSigner } = await import('./nostr/signing/active-signer');
		const { Login } = await import('./Login');
		setActiveSigner(remoteSigner);

		await new Login().withNpub(nip19.npubEncode(me));

		expect(() => getActiveSigner()).toThrow('[logic error]');
	});
});

describe('Login.withNip07', () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		vi.restoreAllMocks();
		notificationVisibility.set('all');
		const { auth } = await import('./auth.svelte');
		auth.reset();
		fetchEvents.mockResolvedValue([['p', followee]]);
	});

	it('initializes without a decrypter when the extension has no encryption capability', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const { auth } = await import('./auth.svelte');
		const { getActiveSigner } = await import('./nostr/signing/active-signer');
		const { Login } = await import('./Login');

		await new Login().withNip07();

		expect(auth.status).toBe('authenticated');
		expect(fetchEvents).toHaveBeenCalledWith(undefined);
		expect(browserSignerInstances).toHaveLength(1);
		expect(getActiveSigner()).toBe(browserSignerInstances[0]);
		expect(warn).not.toHaveBeenCalled();
	});

	it('uses an extension NIP-44 capability for current private lists', async () => {
		const nip44 = {
			encrypt: vi.fn(),
			decrypt: vi.fn().mockResolvedValue(JSON.stringify([['p', 'private']]))
		};
		browserCapabilities.nip44 = nip44;
		const { Login } = await import('./Login');

		await new Login().withNip07();

		const decrypter = fetchEvents.mock.calls[0]?.[0];
		expect(decrypter).toEqual(expect.any(Function));
		await expect(decrypter(me, 'nip44-content')).resolves.toEqual([[['p', 'private']], false]);
	});

	it('uses an extension NIP-04 capability for legacy private lists', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const nip04 = {
			encrypt: vi.fn(),
			decrypt: vi.fn().mockResolvedValue(JSON.stringify([['p', 'private']]))
		};
		browserCapabilities.nip04 = nip04;
		const { Login } = await import('./Login');

		await new Login().withNip07();

		const decrypter = fetchEvents.mock.calls[0]?.[0];
		expect(decrypter).toEqual(expect.any(Function));
		await expect(decrypter(me, 'legacy?iv=value')).resolves.toEqual([[['p', 'private']], true]);
		await expect(decrypter(me, 'nip44-content')).resolves.toEqual([[], false]);
		expect(nip04.decrypt).toHaveBeenCalledOnce();
		expect(warn).not.toHaveBeenCalled();
	});

	it('attaches the same browser signer only after account initialization', async () => {
		const initialized = Promise.withResolvers<void>();
		loadFolloweesMetadataCache.mockReturnValue(initialized.promise);
		const { auth } = await import('./auth.svelte');
		const { getActiveSigner } = await import('./nostr/signing/active-signer');
		const { Login } = await import('./Login');
		const originalEstablish = Object.getPrototypeOf(auth).establish.bind(auth);
		vi.spyOn(auth, 'establish').mockImplementation((pubkey, followingPubkeys) => {
			expect(getActiveSigner()).toBe(browserSignerInstances[0]);
			originalEstablish(pubkey, followingPubkeys);
		});

		const loggingIn = new Login().withNip07();
		await vi.waitFor(() => expect(browserSignerInstances).toHaveLength(1));
		expect(() => getActiveSigner()).toThrow('[logic error]');

		initialized.resolve();
		await loggingIn;

		expect(getActiveSigner()).toBe(browserSignerInstances[0]);
		expect(auth.status).toBe('authenticated');
	});
});

describe('Login.withNsec', () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		vi.restoreAllMocks();
		calls.length = 0;
		notificationVisibility.set('all');

		const { auth } = await import('./auth.svelte');
		auth.reset();

		loadFolloweesMetadataCache.mockResolvedValue(undefined);
		fetchEvents.mockResolvedValue([['p', followee]]);
	});

	it('starts the remote signer for a signing-capable session', async () => {
		const { nip19 } = await import('nostr-tools');
		const { auth } = await import('./auth.svelte');
		const { getActiveSigner } = await import('./nostr/signing/active-signer');
		const { Login } = await import('./Login');

		const seckey = new Uint8Array(32).fill(1);
		const nsec = nip19.nsecEncode(seckey);

		const login = new Login();
		await login.withNsec(nsec);

		expect(auth.status).toBe('authenticated');
		expect(auth.pubkey).toBe(me);
		expect(privateSignerInstances).toHaveLength(1);
		expect(privateSignerInstances[0]?.secretKey).toEqual(seckey);
		expect(getActiveSigner()).toBe(privateSignerInstances[0]);
		expect(remoteSignerSubscribeIfEnabled).toHaveBeenCalledTimes(1);
	});

	it('provides a private-list decrypter from both encryption capabilities', async () => {
		const { nip19 } = await import('nostr-tools');
		const { Login } = await import('./Login');

		await new Login().withNsec(nip19.nsecEncode(new Uint8Array(32).fill(1)));

		expect(fetchEvents).toHaveBeenCalledWith(expect.any(Function));
		expect(privateSignerInstances).toHaveLength(1);
		const { getActiveSigner } = await import('./nostr/signing/active-signer');
		expect(getActiveSigner()).toBe(privateSignerInstances[0]);
	});
});

describe('Login.withNip46', () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		notificationVisibility.set('all');
		const { auth } = await import('./auth.svelte');
		auth.reset();
		fetchEvents.mockResolvedValue([['p', followee]]);
	});

	it('uses the connected remote signer for initialization and the active session', async () => {
		const { getActiveSigner } = await import('./nostr/signing/active-signer');
		const { Login } = await import('./Login');

		await new Login().withNip46('bunker://remote');

		expect(establishBunkerConnection).toHaveBeenCalledWith('bunker://remote');
		expect(fetchEvents).toHaveBeenCalledWith(expect.any(Function));
		expect(getActiveSigner()).toBe(remoteSigner);
	});

	it('cleans up the remote connection when account initialization fails', async () => {
		fetchRelays.mockRejectedValueOnce(new Error('initialization failed'));
		const { getActiveSigner } = await import('./nostr/signing/active-signer');
		const { Login } = await import('./Login');

		await expect(new Login().withNip46('bunker://remote')).rejects.toThrow(
			'initialization failed'
		);

		expect(abolishBunkerConnection).toHaveBeenCalledOnce();
		expect(() => getActiveSigner()).toThrow('[logic error]');
	});
});

describe('session teardown', () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		const { auth } = await import('./auth.svelte');
		const { author, loginType } = await import('./stores/Author');
		auth.reset();
		author.set(undefined);
		loginType.set(undefined);
		abolishBunkerConnection.mockResolvedValue(undefined);
	});

	it('detaches the remote signer and clears session state before cleanup completes', async () => {
		const cleanup = Promise.withResolvers<void>();
		abolishBunkerConnection.mockReturnValue(cleanup.promise);
		const { auth } = await import('./auth.svelte');
		const { author, loginType } = await import('./stores/Author');
		const { getActiveSigner, setActiveSigner } = await import('./nostr/signing/active-signer');
		const { resetLoginState } = await import('./Login');
		auth.establish(me, [followee]);
		author.set({} as Author);
		loginType.set('NIP-46');
		setActiveSigner(remoteSigner);

		const resetting = resetLoginState();

		expect(abolishBunkerConnection).toHaveBeenCalledOnce();
		expect(auth.status).toBe('anonymous');
		expect(get(loginType)).toBeUndefined();
		expect(get(author)).toBeUndefined();
		expect(() => getActiveSigner()).toThrow('[logic error]');
		let resetCompleted = false;
		void resetting.then(() => (resetCompleted = true));
		await Promise.resolve();
		expect(resetCompleted).toBe(false);

		cleanup.resolve();
		await resetting;
	});

	it('clears storage and navigates after session teardown', async () => {
		const calls: string[] = [];
		const cleanup = Promise.withResolvers<void>();
		abolishBunkerConnection.mockImplementation(() => {
			calls.push('dispose');
			return cleanup.promise;
		});
		storageClear.mockImplementation(() => calls.push('clear storage'));
		vi.stubGlobal('location', {
			set href(path: string) {
				calls.push(`navigate:${path}`);
			}
		});
		const { auth } = await import('./auth.svelte');
		const { author, loginType } = await import('./stores/Author');
		const { logout } = await import('./Login');
		auth.establish(me, [followee]);
		author.set({} as Author);
		loginType.set('NIP-46');

		const loggingOut = logout();

		expect(calls).toEqual(['dispose']);
		expect(auth.status).toBe('anonymous');
		expect(get(loginType)).toBeUndefined();
		expect(get(author)).toBeUndefined();

		cleanup.resolve();
		await loggingOut;

		expect(calls).toEqual(['dispose', 'clear storage', 'navigate:/']);
	});
});

describe('tryLogin', () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		const { auth } = await import('./auth.svelte');
		auth.reset();
	});

	it('uses persisted login only to select the login flow', async () => {
		const { auth } = await import('./auth.svelte');
		const { Login, tryLogin } = await import('./Login');
		const establishAuth = () => auth.establish(me, []);
		const flows = {
			nip07: vi.spyOn(Login.prototype, 'withNip07').mockImplementation(async () => {
				establishAuth();
			}),
			nip46: vi.spyOn(Login.prototype, 'withNip46').mockImplementation(async () => {
				establishAuth();
				return true;
			}),
			nsec: vi.spyOn(Login.prototype, 'withNsec').mockImplementation(async () => {
				establishAuth();
			}),
			npub: vi.spyOn(Login.prototype, 'withNpub').mockImplementation(async () => {
				establishAuth();
			})
		};
		const cases = [
			['NIP-07', 'nip07'],
			['bunker://remote', 'nip46'],
			['nsec1saved', 'nsec'],
			['npub1saved', 'npub']
		] as const;

		for (const [savedLogin, selectedFlow] of cases) {
			auth.reset();
			storageGet.mockReturnValue(savedLogin);
			for (const flow of Object.values(flows)) flow.mockClear();

			await expect(tryLogin()).resolves.toBe(true);

			for (const [name, flow] of Object.entries(flows)) {
				expect(flow).toHaveBeenCalledTimes(name === selectedFlow ? 1 : 0);
			}
		}
	});
});
