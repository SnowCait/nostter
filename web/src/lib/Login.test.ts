import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NotificationVisibility } from './preferences/NotificationVisibility.svelte';

const {
	loadFolloweesOfFollowees,
	notificationVisibility,
	fetchEvents,
	fetchRelays,
	loadFolloweesMetadataCache,
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
	}
}));

vi.mock('./timelines/MainTimeline', () => ({
	rxNostr: { getDefaultRelays: vi.fn().mockReturnValue({}), send: vi.fn(), use: vi.fn() }
}));

vi.mock('./cache/Events', () => ({
	loadFolloweesMetadataCache,
	pruneFolloweeReplaceableEventsCache: vi.fn()
}));

vi.mock('./RemoteSigner', () => ({
	remoteSigner: { subscribeIfEnabled: vi.fn() }
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
});
