import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nip19 } from 'nostr-tools';

const mocks = vi.hoisted(() => ({
	fetchRelays: vi.fn(),
	fetchEvents: vi.fn(),
	loadFolloweesMetadataCache: vi.fn(),
	pruneFolloweeReplaceableEventsCache: vi.fn(),
	contactsOfFolloweesReqEmit: vi.fn(),
	subscribeIfEnabled: vi.fn()
}));

vi.mock('./Author', () => ({
	Author: class {
		constructor(readonly pubkey: string) {}
		fetchRelays() {
			return mocks.fetchRelays(this.pubkey);
		}
		fetchEvents() {
			return mocks.fetchEvents(this.pubkey);
		}
	}
}));
vi.mock('./cache/Events', () => ({
	loadFolloweesMetadataCache: mocks.loadFolloweesMetadataCache,
	pruneFolloweeReplaceableEventsCache: mocks.pruneFolloweeReplaceableEventsCache
}));
vi.mock('./author/MuteAutomatically', () => ({
	contactsOfFolloweesReqEmit: mocks.contactsOfFolloweesReqEmit
}));
vi.mock('./Preferences', async () => {
	const { writable } = await import('svelte/store');
	return { preferencesStore: writable({ muteAutomatically: undefined }) };
});
vi.mock('./preferences/NotificationVisibility.svelte', async () => {
	const { writable } = await import('svelte/store');
	return { notificationVisibility: writable('all') };
});
vi.mock('./RemoteSigner', () => ({
	remoteSigner: { subscribeIfEnabled: mocks.subscribeIfEnabled }
}));
vi.mock('./Signer', () => ({ Signer: {} }));
vi.mock('./Items', () => ({ robohash: vi.fn() }));
vi.mock('./timelines/MainTimeline', () => ({ rxNostr: {} }));
vi.mock('./stores/LoginStatus', () => ({
	setLoginStatus: vi.fn(),
	clearLoginStatus: vi.fn()
}));
vi.mock('./stores/Author', async () => {
	const { writable } = await import('svelte/store');
	return {
		author: writable(),
		authorProfile: writable(),
		loginType: writable()
	};
});

import { auth } from './auth.svelte';
import { Login } from './Login';
import { preferencesStore } from './Preferences';
import { notificationVisibility } from './preferences/NotificationVisibility.svelte';

const accountPubkey = 'f'.repeat(64);
const followee = 'a'.repeat(64);

describe('account initialization', () => {
	beforeEach(() => {
		vi.resetAllMocks();
		auth.reset();
		vi.stubGlobal('localStorage', { setItem: vi.fn() });
		mocks.fetchRelays.mockResolvedValue(undefined);
		mocks.fetchEvents.mockResolvedValue({
			originalFollowees: [followee]
		});
		mocks.loadFolloweesMetadataCache.mockResolvedValue(undefined);
		preferencesStore.update((preferences) => {
			preferences.muteAutomatically = undefined;
			return preferences;
		});
		notificationVisibility.set('all');
	});

	it('derives followees while account state is still unpublished', async () => {
		mocks.fetchRelays.mockImplementation((pubkey: string) => {
			expect(pubkey).toBe(accountPubkey);
			expect(auth.pubkey).toBe('');
			expect(auth.followees).toEqual([]);
		});
		mocks.fetchEvents.mockImplementation((pubkey: string) => {
			expect(pubkey).toBe(accountPubkey);
			expect(auth.pubkey).toBe('');
			return { originalFollowees: [followee] };
		});
		mocks.loadFolloweesMetadataCache.mockImplementation((followees: string[]) => {
			expect(followees).toEqual([followee, accountPubkey]);
			expect(auth.pubkey).toBe('');
		});

		await new Login().withNpub(nip19.npubEncode(accountPubkey));

		expect(auth.originalFollowees).toEqual([followee]);
		expect(auth.followees).toEqual([followee, accountPubkey]);
		expect(auth.status).toBe('authenticated');
		expect(mocks.pruneFolloweeReplaceableEventsCache).toHaveBeenCalledWith([
			followee,
			accountPubkey
		]);
		expect(mocks.contactsOfFolloweesReqEmit).not.toHaveBeenCalled();
	});

	it('starts loading with established followees when device visibility requires it', async () => {
		notificationVisibility.set('follows_of_follows');
		mocks.contactsOfFolloweesReqEmit.mockImplementation((followees: string[]) => {
			expect(auth.status).toBe('authenticated');
			expect(followees).toEqual([followee, accountPubkey]);
		});

		await new Login().withNpub(nip19.npubEncode(accountPubkey));

		expect(mocks.contactsOfFolloweesReqEmit).toHaveBeenCalledOnce();
	});

	it('uses visibility at the time initialization finishes', async () => {
		mocks.loadFolloweesMetadataCache.mockImplementation(() => {
			notificationVisibility.set('follows_of_follows');
		});

		await new Login().withNpub(nip19.npubEncode(accountPubkey));

		expect(mocks.contactsOfFolloweesReqEmit).toHaveBeenCalledWith([followee, accountPubkey]);
	});

	it('preserves legacy automatic muting after account initialization', async () => {
		preferencesStore.update((preferences) => {
			preferences.muteAutomatically = true;
			return preferences;
		});

		await new Login().withNpub(nip19.npubEncode(accountPubkey));

		expect(mocks.contactsOfFolloweesReqEmit).toHaveBeenCalledWith([followee, accountPubkey]);
	});

	it('does not publish the pubkey if account initialization fails', async () => {
		mocks.fetchEvents.mockRejectedValue(new Error('fetch failed'));
		await expect(new Login().withNpub(nip19.npubEncode(accountPubkey))).rejects.toThrow(
			'fetch failed'
		);
		expect(auth.pubkey).toBe('');
		expect(auth.followees).toEqual([]);
	});
});
