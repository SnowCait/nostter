import { describe, expect, it } from 'vitest';
import { Auth } from './auth.svelte';

const me = 'f'.repeat(64);
const a = 'a'.repeat(64);
const b = 'b'.repeat(64);

describe('Auth.updateFollowees', () => {
	it('sets originalFollowees and appends self to followees', () => {
		const auth = new Auth();
		auth.pubkey = me;
		auth.updateFollowees([
			['p', a],
			['p', b]
		]);
		expect(auth.originalFollowees).toEqual([a, b]);
		expect(auth.followees).toEqual([a, b, me]);
	});

	it('does not add self to originalFollowees', () => {
		const auth = new Auth();
		auth.pubkey = me;
		auth.updateFollowees([['p', a]]);
		expect(auth.originalFollowees).not.toContain(me);
		expect(auth.followees).toContain(me);
	});

	it('deduplicates followees', () => {
		const auth = new Auth();
		auth.pubkey = me;
		auth.updateFollowees([
			['p', a],
			['p', a],
			['p', b]
		]);
		expect(auth.originalFollowees).toEqual([a, b]);
		expect(auth.followees).toEqual([a, b, me]);
	});

	it('leaves only self when tags are empty', () => {
		const auth = new Auth();
		auth.pubkey = me;
		auth.updateFollowees([]);
		expect(auth.originalFollowees).toEqual([]);
		expect(auth.followees).toEqual([me]);
	});

	it('exposes followeesSet matching followees', () => {
		const auth = new Auth();
		auth.pubkey = me;
		auth.updateFollowees([
			['p', a],
			['p', b]
		]);
		expect(auth.followeesSet).toEqual(new Set([a, b, me]));
	});
});

describe('Auth status machine', () => {
	it('starts idle and initializing', () => {
		const auth = new Auth();
		expect(auth.status).toBe('idle');
		expect(auth.isInitializing).toBe(true);
		expect(auth.isReady).toBe(false);
		expect(auth.isAuthenticated).toBe(false);
	});

	it('stays initializing while restoring', () => {
		const auth = new Auth();
		auth.beginRestoring();
		expect(auth.status).toBe('restoring');
		expect(auth.isInitializing).toBe(true);
		expect(auth.isReady).toBe(false);
		expect(auth.isAuthenticated).toBe(false);
	});

	it('is neither initializing nor ready while authenticating', () => {
		const auth = new Auth();
		auth.beginAuthenticating();
		expect(auth.status).toBe('authenticating');
		expect(auth.isInitializing).toBe(false);
		expect(auth.isReady).toBe(false);
		expect(auth.isAuthenticated).toBe(false);
	});

	it('is ready and authenticated after setAuthenticated', () => {
		const auth = new Auth();
		auth.setAuthenticated();
		expect(auth.status).toBe('authenticated');
		expect(auth.isInitializing).toBe(false);
		expect(auth.isReady).toBe(true);
		expect(auth.isAuthenticated).toBe(true);
	});

	it('is ready but not authenticated after setAnonymous', () => {
		const auth = new Auth();
		auth.setAnonymous();
		expect(auth.status).toBe('anonymous');
		expect(auth.isInitializing).toBe(false);
		expect(auth.isReady).toBe(true);
		expect(auth.isAuthenticated).toBe(false);
	});
});
