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

const accountPubkey = 'a'.repeat(64);
const otherPubkey = 'b'.repeat(64);

function event(kind: number, pubkey = accountPubkey, tags: string[][] = []): Event {
	return { id: 'id', kind, pubkey, tags, content: '', created_at: 1, sig: 'sig' };
}

describe('WebStorage event ownership', () => {
	let storage: WebStorage;

	beforeEach(() => {
		storage = new WebStorage(new MemoryStorage());
	});

	it('stores a replaceable event for the explicit account pubkey', () => {
		const ownEvent = event(3);
		storage.setReplaceableEvent(ownEvent, accountPubkey);
		expect(storage.getReplaceableEvent(3)).toEqual(ownEvent);
	});

	it('rejects another account’s replaceable event without updating the cache', () => {
		const ownEvent = event(3);
		storage.setReplaceableEvent(ownEvent, accountPubkey);
		const cachedAt = storage.getCachedAt();

		expect(() => storage.setReplaceableEvent(event(3, otherPubkey), accountPubkey)).toThrow();
		expect(storage.getReplaceableEvent(3)).toEqual(ownEvent);
		expect(storage.getCachedAt()).toBe(cachedAt);
	});

	it('stores a parameterized event for the explicit account pubkey', () => {
		const ownEvent = event(30078, accountPubkey, [['d', 'settings']]);
		storage.setParameterizedReplaceableEvent(ownEvent, accountPubkey);
		expect(storage.getParameterizedReplaceableEvent(30078, 'settings')).toEqual(ownEvent);
	});

	it('rejects another account’s parameterized event without updating the cache', () => {
		const ownEvent = event(30078, accountPubkey, [['d', 'settings']]);
		storage.setParameterizedReplaceableEvent(ownEvent, accountPubkey);
		const cachedAt = storage.getCachedAt();
		const otherEvent = event(30078, otherPubkey, [['d', 'settings']]);

		expect(() => storage.setParameterizedReplaceableEvent(otherEvent, accountPubkey)).toThrow();
		expect(storage.getParameterizedReplaceableEvent(30078, 'settings')).toEqual(ownEvent);
		expect(storage.getCachedAt()).toBe(cachedAt);
	});

	it('keeps the NIP-01 preferred mute event at equal timestamps', () => {
		const higherId = { ...event(10000), id: 'bb' };
		const lowerId = { ...event(10000), id: 'aa' };
		storage.setReplaceableEvent(higherId, accountPubkey);
		storage.setReplaceableEvent(lowerId, accountPubkey);
		storage.setReplaceableEvent(higherId, accountPubkey);
		expect(storage.getReplaceableEvent(10000)).toEqual(lowerId);

		const higherKindId = { ...event(30007, accountPubkey, [['d', '6']]), id: 'bb' };
		const lowerKindId = { ...higherKindId, id: 'aa' };
		storage.setParameterizedReplaceableEvent(higherKindId, accountPubkey);
		storage.setParameterizedReplaceableEvent(lowerKindId, accountPubkey);
		expect(storage.getParameterizedReplaceableEvent(30007, '6')).toEqual(lowerKindId);
	});

	it('replaces a previous account’s mute cache even when the new event has an older timestamp', () => {
		storage.setReplaceableEvent({ ...event(10000), created_at: 10 }, accountPubkey);
		const nextAccountEvent = { ...event(10000, otherPubkey), created_at: 1 };
		storage.setReplaceableEvent(nextAccountEvent, otherPubkey);
		expect(storage.getReplaceableEvent(10000)).toEqual(nextAccountEvent);
		expect(storage.getCachedAccountPubkey()).toBe(otherPubkey);
	});

	it('finds cached kind mute identifiers for account snapshots', () => {
		storage.setParameterizedReplaceableEvent(
			event(30007, accountPubkey, [['d', '16']]),
			accountPubkey
		);
		storage.setParameterizedReplaceableEvent(
			event(30007, accountPubkey, [['d', '9735']]),
			accountPubkey
		);
		expect(storage.getParameterizedIdentifiers(30007).sort()).toEqual(['16', '9735']);
	});
});
