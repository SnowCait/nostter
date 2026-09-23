import { describe, expect, it, vi } from 'vitest';
import type { Signer } from './nostr/signing/signer';
import { Auth } from './auth.svelte';

const me = 'f'.repeat(64);
const a = 'a'.repeat(64);
const b = 'b'.repeat(64);
const signer = {
	getPublicKey: vi.fn(),
	signEvent: vi.fn()
} satisfies Signer;

describe('Auth lifecycle', () => {
	it('starts initializing', () => {
		const auth = new Auth();
		expect(auth.status).toBe('initializing');
		expect(auth.isInitializing).toBe(true);
		expect(auth.isReady).toBe(false);
		expect(auth.isAuthenticated).toBe(false);
		expect(auth.signer).toBeUndefined();
		expect(auth.loginMethod).toBeUndefined();
	});

	it('is ready but not authenticated after reset', () => {
		const auth = new Auth();
		auth.reset();
		expect(auth.status).toBe('anonymous');
		expect(auth.isInitializing).toBe(false);
		expect(auth.isReady).toBe(true);
		expect(auth.isAuthenticated).toBe(false);
		expect(auth.signer).toBeUndefined();
		expect(auth.loginMethod).toBeUndefined();
	});

	it('is ready and authenticated after establish', () => {
		const auth = new Auth();
		auth.establish({ pubkey: me, followingPubkeys: [], loginMethod: 'npub' });
		expect(auth.status).toBe('authenticated');
		expect(auth.isInitializing).toBe(false);
		expect(auth.isReady).toBe(true);
		expect(auth.isAuthenticated).toBe(true);
		expect(auth.loginMethod).toBe('npub');
	});
});

describe('Auth.establish', () => {
	it('publishes identity and the same signer instance in the authenticated session', () => {
		const auth = new Auth();

		expect(auth.pubkey).toBeUndefined();
		expect(auth.followingPubkeys).toEqual([]);
		expect(auth.followees).toEqual([]);
		expect(auth.isAuthenticated).toBe(false);
		expect(auth.signer).toBeUndefined();

		auth.establish({ pubkey: me, followingPubkeys: [a, b], loginMethod: 'NIP-07', signer });

		expect(auth.pubkey).toBe(me);
		expect(auth.followingPubkeys).toEqual([a, b]);
		expect(auth.followees).toEqual([a, b, me]);
		expect(auth.status).toBe('authenticated');
		expect(auth.isAuthenticated).toBe(true);
		expect(auth.signer).toBe(signer);
		expect(auth.loginMethod).toBe('NIP-07');
	});

	it('represents an authenticated session without a signer', () => {
		const auth = new Auth();

		auth.establish({ pubkey: me, followingPubkeys: [a], loginMethod: 'npub' });

		expect(auth.status).toBe('authenticated');
		expect(auth.pubkey).toBe(me);
		expect(auth.signer).toBeUndefined();
		expect(auth.loginMethod).toBe('npub');
	});

	it('deduplicates followingPubkeys', () => {
		const auth = new Auth();
		auth.establish({ pubkey: me, followingPubkeys: [a, a, b], loginMethod: 'npub' });
		expect(auth.followingPubkeys).toEqual([a, b]);
		expect(auth.followees).toEqual([a, b, me]);
	});
});

describe('Auth.updateFollowingPubkeys', () => {
	it('sets followingPubkeys and re-derives followees with self', () => {
		const auth = new Auth();
		auth.establish({ pubkey: me, followingPubkeys: [], loginMethod: 'npub' });
		auth.updateFollowingPubkeys([a, b]);
		expect(auth.followingPubkeys).toEqual([a, b]);
		expect(auth.followees).toEqual([a, b, me]);
	});

	it('deduplicates followingPubkeys', () => {
		const auth = new Auth();
		auth.establish({ pubkey: me, followingPubkeys: [], loginMethod: 'npub' });
		auth.updateFollowingPubkeys([a, a, b]);
		expect(auth.followingPubkeys).toEqual([a, b]);
		expect(auth.followees).toEqual([a, b, me]);
	});

	it('does not add self to followingPubkeys', () => {
		const auth = new Auth();
		auth.establish({ pubkey: me, followingPubkeys: [], loginMethod: 'npub' });
		auth.updateFollowingPubkeys([a]);
		expect(auth.followingPubkeys).not.toContain(me);
		expect(auth.followees).toContain(me);
	});

	it('leaves only self when followingPubkeys is empty', () => {
		const auth = new Auth();
		auth.establish({ pubkey: me, followingPubkeys: [a, b], loginMethod: 'npub' });
		auth.updateFollowingPubkeys([]);
		expect(auth.followingPubkeys).toEqual([]);
		expect(auth.followees).toEqual([me]);
	});

	it('exposes followeesSet matching followees', () => {
		const auth = new Auth();
		auth.establish({ pubkey: me, followingPubkeys: [], loginMethod: 'npub' });
		auth.updateFollowingPubkeys([a, b]);
		expect(auth.followeesSet).toEqual(new Set([a, b, me]));
	});

	it('rejects updates without an authenticated session', () => {
		const auth = new Auth();
		expect(() => auth.updateFollowingPubkeys([a, b])).toThrow();
	});
});

describe('Auth.reset', () => {
	it('clears authentication state and its signer reference', () => {
		const auth = new Auth();
		auth.establish({ pubkey: me, followingPubkeys: [a, b], loginMethod: 'NIP-07', signer });

		auth.reset();

		expect(auth.pubkey).toBeUndefined();
		expect(auth.followees).toEqual([]);
		expect(auth.followingPubkeys).toEqual([]);
		expect(auth.status).toBe('anonymous');
		expect(auth.signer).toBeUndefined();
		expect(auth.loginMethod).toBeUndefined();
	});
});
