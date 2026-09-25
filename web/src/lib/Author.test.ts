import { describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import { of } from 'rxjs';

const { use } = vi.hoisted(() => ({ use: vi.fn() }));

vi.mock('./timelines/MainTimeline', () => ({
	rxNostr: { use },
	tie: <T>(source: T): T => source
}));
vi.mock('./author/RelayList', () => ({ RelayList: { fetchEvents: vi.fn(), apply: vi.fn() } }));
vi.mock('./cache/Events', () => ({ eventCache: { addIfNotExists: vi.fn() } }));

import { Author } from './Author';
import { WebStorage } from './WebStorage';

const accountA = 'a'.repeat(64);
const accountB = 'b'.repeat(64);

function memoryStorage(): Storage {
	const items = new Map<string, string>();
	return {
		get length() {
			return items.size;
		},
		clear() {
			items.clear();
		},
		getItem(key) {
			return items.get(key) ?? null;
		},
		key(index) {
			return [...items.keys()][index] ?? null;
		},
		removeItem(key) {
			items.delete(key);
		},
		setItem(key, value) {
			items.set(key, value);
		}
	};
}

describe('Author.fetchEvents', () => {
	it('does not start the followees-of-followees loader', async () => {
		const source = await fs.readFile(new URL('./Author.ts', import.meta.url), 'utf-8');

		expect(source).not.toContain('loadFolloweesOfFollowees');
		expect(source).not.toContain('notificationVisibility');
	});

	it('fetches and caches only the target account when another account has cached events', async () => {
		const localStorage = memoryStorage();
		vi.stubGlobal('localStorage', localStorage);
		const storage = new WebStorage(localStorage);
		const cachedA = {
			id: 'a-event',
			kind: 3,
			pubkey: accountA,
			created_at: 1,
			tags: [],
			content: '',
			sig: 'sig'
		};
		const fetchedB = { ...cachedA, id: 'b-event', pubkey: accountB };
		storage.setReplaceableEvent(cachedA, accountA);
		use.mockReturnValue(of({ event: fetchedB }));

		const loadedB = await new Author(accountB).fetchEvents();
		expect(loadedB.replaceableEvents.get(3)).toEqual(fetchedB);
		expect([...loadedB.replaceableEvents.values()]).not.toContainEqual(cachedA);
		expect(storage.getReplaceableEvent(3, accountA)).toEqual(cachedA);
		expect(storage.getReplaceableEvent(3, accountB)).toEqual(fetchedB);
		expect(storage.getCachedAt(accountB)).not.toBeNull();

		storage.setReplaceableEvent({ ...cachedA, id: 'a-late', created_at: 2 }, accountA);
		use.mockClear();
		const cachedB = await new Author(accountB).fetchEvents();
		expect(cachedB.replaceableEvents.get(3)).toEqual(fetchedB);
		expect(storage.getReplaceableEvent(3, accountB)).toEqual(fetchedB);
		expect(use).not.toHaveBeenCalled();
	});
});
