import { beforeEach, describe, expect, it, vi } from 'vitest';

const { persistedStore } = vi.hoisted(() => ({
	persistedStore: vi.fn((_key: string, initialValue: object) => {
		let value = initialValue;
		return {
			subscribe(run: (value: object) => void) {
				run(value);
				return () => undefined;
			},
			set(next: object) {
				value = next;
			},
			update(update: (current: object) => object) {
				value = update(value);
			},
			reset: vi.fn()
		};
	})
}));

vi.mock('$lib/persisted-store', () => ({ persistedStore }));

import { getAccountLocalPreferences } from './AccountLocalPreferences';

describe('getAccountLocalPreferences', () => {
	beforeEach(() => persistedStore.mockClear());

	it('creates one persisted preferences store per account', () => {
		const alice = getAccountLocalPreferences('alice-store-test');
		const sameAlice = getAccountLocalPreferences('alice-store-test');
		const bob = getAccountLocalPreferences('bob-store-test');

		expect(alice).toBe(sameAlice);
		expect(alice).not.toBe(bob);
		expect(persistedStore).toHaveBeenCalledWith('preferences:alice-store-test', {});
		expect(persistedStore).toHaveBeenCalledWith('preferences:bob-store-test', {});
		expect(persistedStore).toHaveBeenCalledTimes(2);
	});
});
