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
	abolishBunkerConnection,
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

	return {
		loadFolloweesOfFollowees: vi.fn(),
		notificationVisibility: createStore<NotificationVisibility>('all'),
		fetchEvents: vi.fn(),
		fetchRelays: vi.fn().mockResolvedValue(undefined),
		loadFolloweesMetadataCache: vi.fn().mockResolvedValue(undefined),
		remoteSignerSubscribeIfEnabled: vi.fn(),
		storageClear: vi.fn(),
		abolishBunkerConnection: vi.fn().mockResolvedValue(undefined),
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
		get = vi.fn().mockReturnValue(null);
		clear = storageClear;
	}
}));

vi.mock('./signer-strategy', () => ({
	resolveSigner: vi.fn(),
	establishBunkerConnection: vi.fn(),
	abolishBunkerConnection
}));

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
		const { nip19, getPublicKey } = await import('nostr-tools');
		const { auth } = await import('./auth.svelte');
		const { Login } = await import('./Login');

		const seckey = new Uint8Array(32).fill(1);
		const nsec = nip19.nsecEncode(seckey);

		const login = new Login();
		await login.withNsec(nsec);

		expect(auth.status).toBe('authenticated');
		expect(auth.pubkey).toBe(getPublicKey(seckey));
		expect(remoteSignerSubscribeIfEnabled).toHaveBeenCalledTimes(1);
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
		const { resetLoginState } = await import('./Login');
		auth.establish(me, [followee]);
		author.set({} as Author);
		loginType.set('NIP-46');

		const resetting = resetLoginState();

		expect(abolishBunkerConnection).toHaveBeenCalledOnce();
		expect(auth.status).toBe('anonymous');
		expect(get(loginType)).toBeUndefined();
		expect(get(author)).toBeUndefined();
		let resetCompleted = false;
		void resetting.then(() => (resetCompleted = true));
		await Promise.resolve();
		expect(resetCompleted).toBe(false);

		cleanup.resolve();
		await resetting;
	});

	it('keeps session state reset when remote signer cleanup fails', async () => {
		abolishBunkerConnection.mockRejectedValue(new Error('close failed'));
		const { auth } = await import('./auth.svelte');
		const { author, loginType } = await import('./stores/Author');
		const { resetLoginState } = await import('./Login');
		auth.establish(me, [followee]);
		author.set({} as Author);
		loginType.set('NIP-46');

		await expect(resetLoginState()).resolves.toBeUndefined();

		expect(auth.status).toBe('anonymous');
		expect(get(loginType)).toBeUndefined();
		expect(get(author)).toBeUndefined();
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
