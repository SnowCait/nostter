import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Event } from 'nostr-tools';

vi.mock('./cache/Events', () => ({
	eventCache: { addIfNotExists: vi.fn() }
}));

import { WebStorage } from './WebStorage';

class MemoryStorage implements Storage {
	private readonly items = new Map<string, string>();

	get length(): number {
		return this.items.size;
	}

	clear(): void {
		this.items.clear();
	}

	getItem(key: string): string | null {
		return this.items.get(key) ?? null;
	}

	key(index: number): string | null {
		return [...this.items.keys()][index] ?? null;
	}

	removeItem(key: string): void {
		this.items.delete(key);
	}

	setItem(key: string, value: string): void {
		this.items.set(key, value);
	}
}

const accountA = 'a'.repeat(64);
const accountB = 'b'.repeat(64);

function event(kind: number, pubkey: string, created_at = 1, tags: string[][] = []): Event {
	return {
		id: `${pubkey}-${kind}-${created_at}`,
		kind,
		pubkey,
		tags,
		content: '',
		created_at,
		sig: 'sig'
	};
}

describe('WebStorage account event cache', () => {
	let storage: WebStorage;

	beforeEach(() => {
		storage = new WebStorage(new MemoryStorage());
	});

	it.each([3, 10000])('keeps kind %i independent across delayed account writes', (kind) => {
		const firstA = event(kind, accountA);
		const secondA = event(kind, accountA, 2);
		const accountBEvent = event(kind, accountB);
		storage.setReplaceableEvent(firstA, accountA);
		storage.setReplaceableEvent(accountBEvent, accountB);
		expect(storage.getReplaceableEvent(kind, accountA)).toEqual(firstA);
		expect(storage.getReplaceableEvent(kind, accountB)).toEqual(accountBEvent);

		storage.setReplaceableEvent(secondA, accountA);
		expect(storage.getReplaceableEvent(kind, accountA)).toEqual(secondA);
		expect(storage.getReplaceableEvent(kind, accountB)).toEqual(accountBEvent);
	});

	it('keeps addressable events and identifiers within each account', () => {
		const firstA = event(30007, accountA, 1, [['d', '6']]);
		const secondA = event(30007, accountA, 2, [['d', '6']]);
		const accountBEvent = event(30007, accountB, 1, [['d', '6']]);
		storage.setParameterizedReplaceableEvent(firstA, accountA);
		storage.setParameterizedReplaceableEvent(event(30007, accountA, 1, [['d', '7']]), accountA);
		storage.setParameterizedReplaceableEvent(accountBEvent, accountB);
		storage.setParameterizedReplaceableEvent(
			event(30007, accountB, 1, [['d', '16']]),
			accountB
		);

		storage.setParameterizedReplaceableEvent(secondA, accountA);
		expect(storage.getParameterizedReplaceableEvent(30007, '6', accountA)).toEqual(secondA);
		expect(storage.getParameterizedReplaceableEvent(30007, '6', accountB)).toEqual(
			accountBEvent
		);
		expect(storage.getParameterizedIdentifiers(30007, accountA)).toEqual(['6', '7']);
		expect(storage.getParameterizedIdentifiers(30007, accountB)).toEqual(['6', '16']);

		storage.removeParameterizedReplaceableEvent(30007, '6', accountA);
		expect(storage.getParameterizedReplaceableEvent(30007, '6', accountA)).toBeUndefined();
		expect(storage.getParameterizedReplaceableEvent(30007, '6', accountB)).toEqual(
			accountBEvent
		);
		storage.removeParameterizedReplaceableEvent(30007, '6', accountB);
		expect(storage.getParameterizedIdentifiers(30007, accountB)).toEqual(['16']);
	});

	it('tracks cache age independently without a global account marker', () => {
		const clock = vi.spyOn(Date, 'now').mockReturnValue(100_000);
		try {
			storage.setReplaceableEvent(event(3, accountA), accountA);
			clock.mockReturnValue(200_000);
			storage.setReplaceableEvent(event(3, accountB), accountB);
			expect(storage.getCachedAt(accountA)).toBe(100);
			expect(storage.getCachedAt(accountB)).toBe(200);
			clock.mockReturnValue(300_000);
			storage.setReplaceableEvent(event(3, accountA, 2), accountA);
			expect(storage.getCachedAt(accountA)).toBe(300);
			expect(storage.getCachedAt(accountB)).toBe(200);
			storage.removeCachedAt(accountA);
			expect(storage.getCachedAt(accountA)).toBeNull();
			expect(storage.getCachedAt(accountB)).toBe(200);
			expect(storage.get('cached_account_pubkey')).toBeNull();
		} finally {
			clock.mockRestore();
		}
	});

	it('rejects events whose author differs from the specified cache account', () => {
		expect(() => storage.setReplaceableEvent(event(3, accountA), accountB)).toThrow(
			'Logic error'
		);
		expect(() =>
			storage.setParameterizedReplaceableEvent(
				event(30007, accountA, 1, [['d', '6']]),
				accountB
			)
		).toThrow('Logic error');
		expect(storage.getReplaceableEvent(3, accountB)).toBeUndefined();
		expect(storage.getParameterizedReplaceableEvent(30007, '6', accountB)).toBeUndefined();
		expect(storage.getCachedAt(accountB)).toBeNull();
	});

	it('keeps login and preferences global while ignoring legacy event cache keys', () => {
		storage.set('login', 'saved-login');
		storage.set('theme', 'dark');
		storage.set('language', 'en');
		storage.set('preference:notifications', 'follows');
		storage.set('kind:3', JSON.stringify(event(3, accountA)));
		storage.set('cached_at', '100');

		expect(storage.getReplaceableEvent(3, accountA)).toBeUndefined();
		expect(storage.getCachedAt(accountA)).toBeNull();
		expect(storage.get('login')).toBe('saved-login');
		expect(storage.get('theme')).toBe('dark');
		expect(storage.get('language')).toBe('en');
		expect(storage.get('preference:notifications')).toBe('follows');
	});
});
