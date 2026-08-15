import { beforeEach, describe, expect, it, vi } from 'vitest';

const { persistedStore, storedValues } = vi.hoisted(() => {
	const storedValues = new Map<string, object>();
	return {
		storedValues,
		persistedStore: vi.fn((key: string, initialValue: object) => {
			let value = storedValues.get(key) ?? initialValue;
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
	};
});

vi.mock('$lib/persisted-store', () => ({ persistedStore }));

import { getAccountLocalPreferences } from './AccountLocalPreferences';

describe('getAccountLocalPreferences', () => {
	beforeEach(() => {
		persistedStore.mockClear();
		storedValues.clear();
	});

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

	it('normalizes the old persisted Blossom shape when reading it', () => {
		storedValues.set('preferences:old-blossom-store-test', {
			mediaUploader: { type: 'blossom' }
		});
		const store = getAccountLocalPreferences('old-blossom-store-test');
		let value: object | undefined;
		store.subscribe((current) => (value = current))();
		expect(value).toEqual({
			mediaUploader: { type: 'blossom', server: 'https://blossom.band' }
		});
	});
});
