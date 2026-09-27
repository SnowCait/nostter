import { describe, expect, it, vi } from 'vitest';
import type { Event, EventTemplate } from 'nostr-tools';
import { PinnedNotesRuntime } from './pinned-notes-runtime.svelte';

const owner = 'a'.repeat(64);
const other = 'b'.repeat(64);

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (error: Error) => void;
	const promise = new Promise<T>((yes, no) => {
		resolve = yes;
		reject = no;
	});
	return { promise, resolve, reject };
}

function event(tags: string[][] = [], created_at = 1, pubkey = owner): Event {
	return {
		id: `${created_at}-${tags.length}`,
		pubkey,
		kind: 10001,
		created_at,
		tags,
		content: 'encrypted private pins',
		sig: 'sig'
	} as Event;
}

async function flush() {
	await Promise.resolve();
	await Promise.resolve();
	await Promise.resolve();
}

function setup(initial?: Event) {
	let second = 10;
	const waits: ReturnType<typeof deferred<void>>[] = [];
	const publications: ReturnType<typeof deferred<void>>[] = [];
	const templates: EventTemplate[] = [];
	const cache = vi.fn(async () => true);
	const getCached = vi.fn(async (): Promise<Event | undefined> => undefined);
	const runtime = new PinnedNotesRuntime({
		now: () => second,
		wait: () => {
			const next = deferred<void>();
			waits.push(next);
			return next.promise;
		},
		publish: () => {
			const next = deferred<void>();
			publications.push(next);
			return next.promise;
		},
		cache,
		getCached
	});
	const sign = vi.fn(async (template: EventTemplate) => {
		templates.push(template);
		return { ...event(template.tags, template.created_at), content: template.content };
	});
	runtime.initialize(owner, initial);
	return {
		runtime,
		sign,
		cache,
		getCached,
		templates,
		publications,
		waits,
		advance: () => {
			second++;
		},
		resolveWait: async () => {
			waits.shift()!.resolve();
			await flush();
		}
	};
}

describe('pinned notes persistence', () => {
	it('initializes owner and canonical, then saves an immediate optimistic snapshot preserving content', async () => {
		const s = setup(
			event([
				['e', 'old', 'relay'],
				['t', 'other']
			])
		);
		expect(s.runtime.owner).toBe(owner);
		s.runtime.pin('new', s.sign);
		expect(s.runtime.effectivePinnedEventIds).toEqual(['old', 'new']);
		expect(s.runtime.phase).toBe('signing');
		await flush();
		expect(s.templates[0]).toMatchObject({
			kind: 10001,
			content: 'encrypted private pins',
			tags: [
				['e', 'old', 'relay'],
				['t', 'other'],
				['e', 'new']
			]
		});
		expect(s.runtime.phase).toBe('publishing');
		s.publications[0].resolve();
		await flush();
		expect(s.cache).toHaveBeenCalledOnce();
		expect(s.runtime.canonical?.tags).toEqual(s.templates[0].tags);
		expect(s.runtime.effectivePinnedEventIds).toEqual(['old', 'new']);
	});

	it('keeps signing and publishing additions pending, then combines them into one next snapshot', async () => {
		const s = setup();
		const signing = deferred<Event>();
		s.sign.mockImplementationOnce(() => signing.promise);
		s.runtime.pin('a', s.sign);
		s.runtime.pin('b', s.sign);
		expect(s.runtime.pending).toHaveLength(1);
		signing.resolve(event([['e', 'a']], 10));
		await flush();
		s.runtime.unpin('a', s.sign);
		await flush();
		expect(s.runtime.pending).toHaveLength(2);
		expect(s.runtime.effectivePinnedEventIds).toEqual(['b']);
		s.publications[0].resolve();
		await flush();
		expect(s.runtime.effectivePinnedEventIds).toEqual(['b']);
		expect(s.sign).toHaveBeenCalledTimes(1);
		expect(s.waits).toHaveLength(1);
		s.advance();
		await s.resolveWait();
		expect(s.templates[0].tags).toEqual([['e', 'b']]);
		expect(s.templates[0].created_at).toBe(11);
		s.publications[1].resolve();
		await flush();
		expect(s.runtime.canonical?.tags).toEqual([['e', 'b']]);
	});

	it('rolls back signing failure and clears pending', async () => {
		const s = setup(event([['e', 'old']]));
		const signing = deferred<Event>();
		s.sign.mockImplementationOnce(() => signing.promise);
		s.runtime.pin('new', s.sign);
		s.runtime.unpin('old', s.sign);
		signing.reject(new Error('cancelled'));
		await flush();
		expect(s.runtime.effectivePinnedEventIds).toEqual(['old']);
		expect(s.runtime.pending).toEqual([]);
		expect(s.runtime.phase).toBe('idle');
		expect(s.runtime.failure?.stage).toBe('signing');
	});

	it('rolls back a publish failure without pending', async () => {
		const s = setup();
		s.runtime.pin('a', s.sign);
		await flush();
		s.publications[0].reject(new Error('relay'));
		await flush();
		expect(s.runtime.effectivePinnedEventIds).toEqual([]);
		expect(s.runtime.failure?.stage).toBe('publishing');
	});

	it('waits before signing a new attempt after a failed publish in the same second', async () => {
		const s = setup();
		s.runtime.pin('a', s.sign);
		await flush();
		s.publications[0].reject(new Error('relay'));
		await flush();
		s.runtime.pin('b', s.sign);
		expect(s.runtime.effectivePinnedEventIds).toEqual(['b']);
		expect(s.sign).toHaveBeenCalledTimes(1);
		s.advance();
		await s.resolveWait();
		expect(s.templates[1].created_at).toBe(11);
		expect(s.templates[1].tags).toEqual([['e', 'b']]);
	});

	it('waits while canonical and local time share a second', async () => {
		const s = setup(event([['e', 'old']], 10));
		s.runtime.pin('new', s.sign);
		expect(s.runtime.effectivePinnedEventIds).toEqual(['old', 'new']);
		expect(s.sign).not.toHaveBeenCalled();
		s.advance();
		await s.resolveWait();
		expect(s.templates[0].created_at).toBe(11);
	});

	it('merges a failed batch with pending once and reports only a final failure', async () => {
		const s = setup();
		s.runtime.pin('a', s.sign);
		await flush();
		s.runtime.pin('b', s.sign);
		s.publications[0].reject(new Error('relay'));
		await flush();
		expect(s.runtime.failure).toBeUndefined();
		expect(s.runtime.inFlight).toHaveLength(2);
		s.advance();
		await s.resolveWait();
		expect(s.templates[1].tags).toEqual([
			['e', 'a'],
			['e', 'b']
		]);
		s.publications[1].reject(new Error('relay again'));
		await flush();
		expect(s.runtime.failure?.stage).toBe('publishing');
		expect(s.runtime.effectivePinnedEventIds).toEqual([]);
		expect(s.sign).toHaveBeenCalledTimes(2);
	});

	it('commits the merged retry on success', async () => {
		const s = setup();
		s.runtime.pin('a', s.sign);
		await flush();
		s.runtime.pin('b', s.sign);
		s.publications[0].reject(new Error('relay'));
		await flush();
		s.advance();
		await s.resolveWait();
		s.publications[1].resolve();
		await flush();
		expect(s.runtime.canonical?.tags).toEqual([
			['e', 'a'],
			['e', 'b']
		]);
		expect(s.runtime.failure).toBeUndefined();
	});

	it('rebases an accepted event on a different cache winner without losing in-flight or pending intent', async () => {
		const s = setup(event([['e', 'old']]));
		const winner = { ...event([['e', 'remote']], 10), id: '0' };
		s.cache.mockResolvedValueOnce(false);
		s.getCached.mockResolvedValueOnce(winner);
		s.runtime.pin('mine', s.sign);
		await flush();
		s.runtime.unpin('old', s.sign);
		s.publications[0].resolve();
		await flush();
		expect(s.runtime.canonical).toBe(winner);
		expect(s.runtime.effectivePinnedEventIds).toEqual(['remote', 'mine']);
		expect(s.runtime.inFlight).toHaveLength(2);
		expect(s.sign).toHaveBeenCalledTimes(1);
		s.advance();
		await s.resolveWait();
		expect(s.templates[1].tags).toEqual([
			['e', 'remote'],
			['e', 'mine']
		]);
		expect(s.templates[1].created_at).toBe(11);
		s.publications[1].resolve();
		await flush();
		expect(s.runtime.canonical?.tags).toEqual([
			['e', 'remote'],
			['e', 'mine']
		]);
		expect(s.runtime.failure).toBeUndefined();
	});

	it('stops automatic rebasing after a second concurrent cache winner while retaining intent', async () => {
		const s = setup();
		const firstWinner = { ...event([['e', 'remote-a']], 10), id: '0' };
		const secondWinner = { ...event([['e', 'remote-b']], 11), id: '1' };
		s.cache.mockResolvedValueOnce(false).mockResolvedValueOnce(false);
		s.getCached.mockResolvedValueOnce(firstWinner).mockResolvedValueOnce(secondWinner);
		s.runtime.pin('mine', s.sign);
		await flush();
		s.publications[0].resolve();
		await flush();
		s.advance();
		await s.resolveWait();
		s.publications[1].resolve();
		await flush();
		expect(s.runtime.canonical).toBe(secondWinner);
		expect(s.runtime.effectivePinnedEventIds).toEqual(['remote-b', 'mine']);
		expect(s.runtime.phase).toBe('reconciling');
		expect(s.runtime.failure?.stage).toBe('reconciling');
		expect(s.publications).toHaveLength(2);
	});

	it('keeps relay-accepted intent and reports a cache failure without republishing', async () => {
		const s = setup(event([['e', 'old']]));
		s.cache.mockRejectedValueOnce(new Error('IndexedDB unavailable'));
		s.runtime.pin('mine', s.sign);
		await flush();
		s.publications[0].resolve();
		await flush();
		expect(s.runtime.phase).toBe('reconciling');
		expect(s.runtime.failure?.stage).toBe('caching');
		expect(s.runtime.canonical?.tags).toEqual([['e', 'old']]);
		expect(s.runtime.acceptedEvent?.tags).toEqual([
			['e', 'old'],
			['e', 'mine']
		]);
		expect(s.runtime.effectivePinnedEventIds).toEqual(['old', 'mine']);
		expect(s.publications).toHaveLength(1);
		s.runtime.reconcile(s.sign);
		await flush();
		expect(s.runtime.canonical?.tags).toEqual([
			['e', 'old'],
			['e', 'mine']
		]);
		expect(s.runtime.phase).toBe('idle');
		expect(s.runtime.failure).toBeUndefined();
		expect(s.publications).toHaveLength(1);
	});

	it('preserves pending operations across cache recovery and saves their next snapshot', async () => {
		const s = setup(event([['e', 'old']]));
		s.cache.mockRejectedValueOnce(new Error('IndexedDB unavailable'));
		s.runtime.pin('mine', s.sign);
		await flush();
		s.runtime.unpin('old', s.sign);
		s.publications[0].resolve();
		await flush();
		expect(s.runtime.pending).toHaveLength(1);
		expect(s.runtime.effectivePinnedEventIds).toEqual(['mine']);
		s.runtime.reconcile(s.sign);
		await flush();
		expect(s.runtime.canonical?.tags).toEqual([
			['e', 'old'],
			['e', 'mine']
		]);
		expect(s.runtime.effectivePinnedEventIds).toEqual(['mine']);
		expect(s.publications).toHaveLength(1);
		s.advance();
		await s.resolveWait();
		expect(s.templates[1].tags).toEqual([['e', 'mine']]);
		s.publications[1].resolve();
		await flush();
		expect(s.runtime.canonical?.tags).toEqual([['e', 'mine']]);
	});

	it('accepts an already cached copy of the published event without another publish', async () => {
		const s = setup();
		s.cache.mockResolvedValueOnce(false);
		s.getCached.mockImplementationOnce(async () => s.runtime.acceptedEvent);
		s.runtime.pin('mine', s.sign);
		await flush();
		s.publications[0].resolve();
		await flush();
		expect(s.runtime.canonical?.tags).toEqual([['e', 'mine']]);
		expect(s.runtime.phase).toBe('idle');
		expect(s.publications).toHaveLength(1);
	});

	it('does not let cache winner lookup completion cross an account switch or reset', async () => {
		const s = setup();
		const lookup = deferred<Event | undefined>();
		s.cache.mockResolvedValueOnce(false);
		s.getCached.mockImplementationOnce(() => lookup.promise);
		s.runtime.pin('mine', s.sign);
		await flush();
		s.publications[0].resolve();
		await flush();
		expect(s.getCached).toHaveBeenCalledOnce();
		const newAccount = event([['e', 'new-account']], 2, other);
		s.runtime.initialize(other, newAccount);
		lookup.resolve(event([['e', 'old-account']], 10));
		await flush();
		expect(s.runtime.owner).toBe(other);
		expect(s.runtime.canonical).toBe(newAccount);
		expect(s.runtime.failure).toBeUndefined();
		expect(s.publications).toHaveLength(1);

		const t = setup();
		const resetLookup = deferred<Event | undefined>();
		t.cache.mockResolvedValueOnce(false);
		t.getCached.mockImplementationOnce(() => resetLookup.promise);
		t.runtime.pin('mine', t.sign);
		await flush();
		t.publications[0].resolve();
		await flush();
		t.runtime.reset();
		resetLookup.resolve(event([['e', 'old-account']], 10));
		await flush();
		expect(t.runtime.owner).toBeUndefined();
		expect(t.runtime.canonical).toBeUndefined();
		expect(t.runtime.failure).toBeUndefined();
	});

	it('rejects a future canonical timestamp and a wrong signing owner', async () => {
		const s = setup(event([], 11));
		s.runtime.pin('a', s.sign);
		await flush();
		expect(s.sign).not.toHaveBeenCalled();
		expect(s.runtime.failure?.stage).toBe('signing');
		const t = setup();
		t.sign.mockResolvedValueOnce(event([['e', 'a']], 10, other));
		t.runtime.pin('a', t.sign);
		await flush();
		expect(t.publications).toHaveLength(0);
		expect(t.cache).not.toHaveBeenCalled();
		expect(t.runtime.failure?.stage).toBe('signing');
	});

	it('ignores stale completion and failure after an account switch or reset', async () => {
		const s = setup();
		s.runtime.pin('a', s.sign);
		await flush();
		s.runtime.initialize(other, event([['e', 'b']], 2, other));
		s.publications[0].reject(new Error('old relay'));
		await flush();
		expect(s.runtime.owner).toBe(other);
		expect(s.runtime.effectivePinnedEventIds).toEqual(['b']);
		expect(s.runtime.failure).toBeUndefined();
		expect(s.cache).not.toHaveBeenCalled();
		s.runtime.reset();
		expect(s.runtime.owner).toBeUndefined();
		expect(s.runtime.canonical).toBeUndefined();
		expect(s.runtime.effectivePinnedEventIds).toEqual([]);
	});

	it('does not publish a signature returned after switching accounts', async () => {
		const s = setup();
		const signing = deferred<Event>();
		s.sign.mockImplementationOnce(() => signing.promise);
		s.runtime.pin('a', s.sign);
		s.runtime.initialize(other);
		signing.resolve(event([['e', 'a']], 10));
		await flush();
		expect(s.publications).toHaveLength(0);
		expect(s.runtime.owner).toBe(other);
		expect(s.runtime.failure).toBeUndefined();
	});
});
