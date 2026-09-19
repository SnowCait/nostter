import { describe, expect, it } from 'vitest';
import { Auth } from './auth.svelte';

const me = 'f'.repeat(64);
const a = 'a'.repeat(64);
const b = 'b'.repeat(64);

describe('Auth lifecycle', () => {
	it('starts initializing', () => {
		const auth = new Auth();
		expect(auth.status).toBe('initializing');
		expect(auth.isInitializing).toBe(true);
		expect(auth.isReady).toBe(false);
		expect(auth.isAuthenticated).toBe(false);
	});

	it('is ready but not authenticated after reset', () => {
		const auth = new Auth();
		auth.reset();
		expect(auth.status).toBe('anonymous');
		expect(auth.isInitializing).toBe(false);
		expect(auth.isReady).toBe(true);
		expect(auth.isAuthenticated).toBe(false);
	});

	it('is ready and authenticated after establish', () => {
		const auth = new Auth();
		auth.establish(me, []);
		expect(auth.status).toBe('authenticated');
		expect(auth.isInitializing).toBe(false);
		expect(auth.isReady).toBe(true);
		expect(auth.isAuthenticated).toBe(true);
	});
});

describe('Auth.establish', () => {
	it('publishes pubkey, followingPubkeys, followees and authenticated status together', () => {
		const auth = new Auth();

		expect(auth.pubkey).toBe('');
		expect(auth.followingPubkeys).toEqual([]);
		expect(auth.followees).toEqual([]);
		expect(auth.isAuthenticated).toBe(false);

		auth.establish(me, [a, b]);

		expect(auth.pubkey).toBe(me);
		expect(auth.followingPubkeys).toEqual([a, b]);
		expect(auth.followees).toEqual([a, b, me]);
		expect(auth.status).toBe('authenticated');
		expect(auth.isAuthenticated).toBe(true);
	});

	it('deduplicates followingPubkeys', () => {
		const auth = new Auth();
		auth.establish(me, [a, a, b]);
		expect(auth.followingPubkeys).toEqual([a, b]);
		expect(auth.followees).toEqual([a, b, me]);
	});
});

describe('Auth.updateFollowingPubkeys', () => {
	it('sets followingPubkeys and appends self to followees', () => {
		const auth = new Auth();
		auth.establish(me, []);
		auth.updateFollowingPubkeys([a, b], me);
		expect(auth.followingPubkeys).toEqual([a, b]);
		expect(auth.followees).toEqual([a, b, me]);
	});

	it('deduplicates followingPubkeys', () => {
		const auth = new Auth();
		auth.establish(me, []);
		auth.updateFollowingPubkeys([a, a, b], me);
		expect(auth.followingPubkeys).toEqual([a, b]);
		expect(auth.followees).toEqual([a, b, me]);
	});

	it('does not add self to followingPubkeys', () => {
		const auth = new Auth();
		auth.establish(me, []);
		auth.updateFollowingPubkeys([a], me);
		expect(auth.followingPubkeys).not.toContain(me);
		expect(auth.followees).toContain(me);
	});

	it('leaves only self when followingPubkeys is empty', () => {
		const auth = new Auth();
		auth.establish(me, [a, b]);
		auth.updateFollowingPubkeys([], me);
		expect(auth.followingPubkeys).toEqual([]);
		expect(auth.followees).toEqual([me]);
	});

	it('exposes followeesSet matching followees', () => {
		const auth = new Auth();
		auth.establish(me, []);
		auth.updateFollowingPubkeys([a, b], me);
		expect(auth.followeesSet).toEqual(new Set([a, b, me]));
	});

	it('uses the explicitly passed accountPubkey as self, ignoring auth.pubkey', () => {
		const auth = new Auth();
		auth.establish(b, []);
		auth.updateFollowingPubkeys([a], me);
		expect(auth.followees).toEqual([a, me]);
		expect(auth.followees).not.toContain(b);
	});

	it('rejects updates without an authenticated session', () => {
		const auth = new Auth();
		expect(() => auth.updateFollowingPubkeys([a, b], me)).toThrow();
	});
});

describe('Auth.reset', () => {
	it('clears authentication state and becomes anonymous', () => {
		const auth = new Auth();
		auth.establish(me, [a, b]);

		auth.reset();

		expect(auth.pubkey).toBe('');
		expect(auth.followees).toEqual([]);
		expect(auth.followingPubkeys).toEqual([]);
		expect(auth.status).toBe('anonymous');
	});
});
