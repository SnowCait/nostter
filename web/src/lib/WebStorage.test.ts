import { describe, expect, it } from 'vitest';
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

describe('WebStorage settings', () => {
	it('keeps login, preference, theme and language values under their existing keys', () => {
		const localStorage = new MemoryStorage();
		const storage = new WebStorage(localStorage);
		for (const [key, value] of [
			['login', 'account'],
			['preference:notifications', 'on'],
			['theme', 'dark'],
			['language', 'ja']
		]) {
			storage.set(key, value);
			expect(storage.get(key)).toBe(value);
			expect(localStorage.getItem(`nostter:${key}`)).toBe(value);
		}
		storage.remove('theme');
		expect(storage.get('theme')).toBeNull();
		expect(storage.get('login')).toBe('account');
	});
});
