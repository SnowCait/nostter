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
	await Promise.resolve();
}

function setup(initial?: Event) {
	let second = 10;
	const waits: ReturnType<typeof deferred<void>>[] = [];
	const publications: ReturnType<typeof deferred<void>>[] = [];
	const templates: EventTemplate[] = [];
	const fetchLatest = vi.fn(async (): Promise<Event | undefined> => undefined);
	const publish = vi.fn(() => {
		const next = deferred<void>();
		publications.push(next);
		return next.promise;
	});
	const cache = vi.fn(async () => true);
	const runtime = new PinnedNotesRuntime({
		fetchLatest,
		publish,
		now: () => second,
		wait: () => {
			const next = deferred<void>();
			waits.push(next);
			return next.promise;
		},
		cache
	});
	const sign = vi.fn(async (template: EventTemplate) => {
		templates.push(template);
		return { ...event(template.tags, template.created_at), content: template.content };
	});
	runtime.initialize(owner, initial);
	return {
		runtime,
		sign,
		fetchLatest,
		publish,
		cache,
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
	it('starts fetching immediately and rebases a first pin on relay latest', async () => {
		const s = setup();
		const latest = {
			...event(
				[
					['e', 'a'],
					['e', 'b']
				],
				5
			),
			content: 'remote encrypted pins'
		};
		const fetching = deferred<Event | undefined>();
		s.fetchLatest.mockImplementationOnce(() => fetching.promise);
		s.runtime.pin('c', s.sign);
		expect(s.runtime.phase).toBe('fetching');
		expect(s.runtime.effectivePinnedEventIds).toEqual(['c']);
		expect(s.fetchLatest).toHaveBeenCalledWith(owner);
		expect(s.sign).not.toHaveBeenCalled();
		fetching.resolve(latest);
		await flush();
		expect(s.runtime.canonical).toBe(latest);
		expect(s.templates[0]).toMatchObject({
			kind: 10001,
			content: 'remote encrypted pins',
			tags: [
				['e', 'a'],
				['e', 'b'],
				['e', 'c']
			]
		});
		s.publications[0].resolve();
		await flush();
		expect(s.runtime.canonical?.tags).toEqual([
			['e', 'a'],
			['e', 'b'],
			['e', 'c']
		]);
	});

	it('uses newer relay state and keeps operations optimistic while fetch is pending', async () => {
		const s = setup(event([['e', 'local']], 3));
		const latest = event(
			[
				['e', 'local'],
				['e', 'remote']
			],
			6
		);
		const fetching = deferred<Event | undefined>();
		s.fetchLatest.mockImplementationOnce(() => fetching.promise);
		s.runtime.pin('mine', s.sign);
		s.runtime.unpin('local', s.sign);
		expect(s.runtime.pending).toHaveLength(1);
		expect(s.runtime.effectivePinnedEventIds).toEqual(['mine']);
		fetching.resolve(latest);
		await flush();
		expect(s.runtime.canonical).toBe(latest);
		expect(s.runtime.effectivePinnedEventIds).toEqual(['remote', 'mine']);
		s.publications[0].resolve();
		await flush();
		expect(s.runtime.effectivePinnedEventIds).toEqual(['remote', 'mine']);
	});

	it('keeps a newer locally confirmed canonical when a relay returns an older event', async () => {
		const local = event([['e', 'local']], 7);
		const s = setup(local);
		s.fetchLatest.mockResolvedValueOnce(event([['e', 'older']], 5));
		s.runtime.pin('mine', s.sign);
		await flush();
		expect(s.runtime.canonical).toBe(local);
		expect(s.templates[0].tags).toEqual([
			['e', 'local'],
			['e', 'mine']
		]);
		s.publications[0].resolve();
		await flush();
		expect(s.runtime.effectivePinnedEventIds).toEqual(['local', 'mine']);
	});

	it('uses local canonical or an empty list when relays have no event', async () => {
		const s = setup(event([['e', 'local']], 1));
		s.runtime.pin('mine', s.sign);
		await flush();
		expect(s.templates[0].tags).toEqual([
			['e', 'local'],
			['e', 'mine']
		]);
		const t = setup();
		t.runtime.pin('mine', t.sign);
		await flush();
		expect(t.templates[0].tags).toEqual([['e', 'mine']]);
		expect(t.templates[0].content).toBe('');
	});

	it('rolls back fetch failure without signing or publishing', async () => {
		const s = setup(event([['e', 'old']]));
		const fetching = deferred<Event | undefined>();
		s.fetchLatest.mockImplementationOnce(() => fetching.promise);
		s.runtime.pin('mine', s.sign);
		s.runtime.unpin('old', s.sign);
		fetching.reject(new Error('offline'));
		await flush();
		expect(s.runtime.effectivePinnedEventIds).toEqual(['old']);
		expect(s.runtime.inFlight).toEqual([]);
		expect(s.runtime.pending).toEqual([]);
		expect(s.runtime.phase).toBe('idle');
		expect(s.runtime.failure?.stage).toBe('fetching');
		expect(s.sign).not.toHaveBeenCalled();
		expect(s.publications).toHaveLength(0);
	});

	it('keeps signing and publishing additions pending, then combines them after success', async () => {
		const s = setup();
		const signing = deferred<Event>();
		s.sign.mockImplementationOnce(() => signing.promise);
		s.runtime.pin('a', s.sign);
		await flush();
		s.runtime.pin('b', s.sign);
		expect(s.runtime.pending).toHaveLength(1);
		signing.resolve(event([['e', 'a']], 10));
		await flush();
		s.runtime.unpin('a', s.sign);
		expect(s.runtime.pending).toHaveLength(2);
		expect(s.runtime.effectivePinnedEventIds).toEqual(['b']);
		s.publications[0].resolve();
		await flush();
		expect(s.runtime.effectivePinnedEventIds).toEqual(['b']);
		expect(s.fetchLatest).toHaveBeenCalledTimes(2);
		expect(s.sign).toHaveBeenCalledTimes(1);
		s.advance();
		await s.resolveWait();
		expect(s.templates[0].tags).toEqual([['e', 'b']]);
		expect(s.templates[0].created_at).toBe(11);
		s.publications[1].resolve();
		await flush();
		expect(s.runtime.canonical?.tags).toEqual([['e', 'b']]);
	});

	it('waits after fetching when base canonical or last signing attempt shares the current second', async () => {
		const s = setup(event([['e', 'old']], 10));
		s.runtime.pin('new', s.sign);
		await flush();
		expect(s.sign).not.toHaveBeenCalled();
		expect(s.runtime.effectivePinnedEventIds).toEqual(['old', 'new']);
		s.advance();
		await s.resolveWait();
		expect(s.templates[0].created_at).toBe(11);

		const t = setup();
		t.runtime.pin('a', t.sign);
		await flush();
		t.publications[0].reject(new Error('relay'));
		await flush();
		t.runtime.pin('b', t.sign);
		await flush();
		expect(t.sign).toHaveBeenCalledTimes(1);
		t.advance();
		await t.resolveWait();
		expect(t.templates[1].created_at).toBe(11);
	});

	it('fails safely when the fetched base has a future timestamp', async () => {
		const s = setup();
		s.fetchLatest.mockResolvedValueOnce(event([['e', 'future']], 11));
		s.runtime.pin('mine', s.sign);
		await flush();
		expect(s.runtime.canonical?.tags).toEqual([['e', 'future']]);
		expect(s.runtime.effectivePinnedEventIds).toEqual(['future']);
		expect(s.runtime.failure?.stage).toBe('signing');
		expect(s.sign).not.toHaveBeenCalled();
	});

	it('rolls back signing failure and rejects a wrong signing owner', async () => {
		const s = setup(event([['e', 'old']]));
		const signing = deferred<Event>();
		s.sign.mockImplementationOnce(() => signing.promise);
		s.runtime.pin('new', s.sign);
		await flush();
		s.runtime.unpin('old', s.sign);
		signing.reject(new Error('cancelled'));
		await flush();
		expect(s.runtime.effectivePinnedEventIds).toEqual(['old']);
		expect(s.runtime.pending).toEqual([]);
		expect(s.runtime.failure?.stage).toBe('signing');
		const t = setup();
		t.sign.mockResolvedValueOnce(event([['e', 'a']], 10, other));
		t.runtime.pin('a', t.sign);
		await flush();
		expect(t.publications).toHaveLength(0);
		expect(t.cache).not.toHaveBeenCalled();
		expect(t.runtime.failure?.stage).toBe('signing');
	});

	it('rolls back a publish failure with no pending operation', async () => {
		const s = setup();
		s.runtime.pin('a', s.sign);
		await flush();
		s.publications[0].reject(new Error('relay'));
		await flush();
		expect(s.runtime.effectivePinnedEventIds).toEqual([]);
		expect(s.runtime.failure?.stage).toBe('publishing');
	});

	it('refetches and retries one merged snapshot after a publish failure with pending', async () => {
		const s = setup();
		s.fetchLatest
			.mockResolvedValueOnce(undefined)
			.mockResolvedValueOnce(event([['e', 'remote']], 10));
		s.runtime.pin('a', s.sign);
		await flush();
		s.runtime.pin('b', s.sign);
		s.publications[0].reject(new Error('relay'));
		await flush();
		expect(s.runtime.failure).toBeUndefined();
		expect(s.runtime.inFlight).toHaveLength(2);
		expect(s.fetchLatest).toHaveBeenCalledTimes(2);
		s.advance();
		await s.resolveWait();
		expect(s.templates[1].tags).toEqual([
			['e', 'remote'],
			['e', 'a'],
			['e', 'b']
		]);
		s.publications[1].resolve();
		await flush();
		expect(s.runtime.canonical?.tags).toEqual([
			['e', 'remote'],
			['e', 'a'],
			['e', 'b']
		]);
		expect(s.runtime.failure).toBeUndefined();
	});

	it('stops after the merged retry fails', async () => {
		const s = setup();
		s.runtime.pin('a', s.sign);
		await flush();
		s.runtime.pin('b', s.sign);
		s.publications[0].reject(new Error('relay'));
		await flush();
		s.advance();
		await s.resolveWait();
		s.publications[1].reject(new Error('relay again'));
		await flush();
		expect(s.runtime.effectivePinnedEventIds).toEqual([]);
		expect(s.runtime.failure?.stage).toBe('publishing');
		expect(s.sign).toHaveBeenCalledTimes(2);
		expect(s.fetchLatest).toHaveBeenCalledTimes(2);
	});

	it('treats cache false or rejection as best effort after relay acceptance', async () => {
		const s = setup();
		s.cache.mockResolvedValueOnce(false);
		s.runtime.pin('a', s.sign);
		await flush();
		s.publications[0].resolve();
		await flush();
		expect(s.runtime.canonical?.tags).toEqual([['e', 'a']]);
		expect(s.runtime.phase).toBe('idle');
		expect(s.runtime.failure).toBeUndefined();
		const t = setup();
		const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
		try {
			t.cache.mockRejectedValueOnce(new Error('cache unavailable'));
			t.runtime.pin('a', t.sign);
			await flush();
			t.publications[0].resolve();
			await flush();
			expect(t.runtime.canonical?.tags).toEqual([['e', 'a']]);
			expect(t.runtime.phase).toBe('idle');
			expect(t.runtime.failure).toBeUndefined();
			expect(t.publications).toHaveLength(1);
			expect(warning).toHaveBeenCalledOnce();
		} finally {
			warning.mockRestore();
		}
	});

	it('does not wait for cache before saving pending operations', async () => {
		const s = setup();
		const cacheWrite = deferred<boolean>();
		s.cache.mockImplementationOnce(() => cacheWrite.promise);
		s.runtime.pin('a', s.sign);
		await flush();
		s.runtime.pin('b', s.sign);
		s.publications[0].resolve();
		await flush();
		expect(s.fetchLatest).toHaveBeenCalledTimes(2);
		expect(s.runtime.effectivePinnedEventIds).toEqual(['a', 'b']);
		s.advance();
		await s.resolveWait();
		expect(s.publications).toHaveLength(2);
		cacheWrite.resolve(false);
		s.publications[1].resolve();
		await flush();
		expect(s.runtime.canonical?.tags).toEqual([
			['e', 'a'],
			['e', 'b']
		]);
	});

	it('ignores stale fetch, sign, and publish completions after account switches or reset', async () => {
		const successfulFetch = setup();
		const latest = deferred<Event | undefined>();
		successfulFetch.fetchLatest.mockImplementationOnce(() => latest.promise);
		successfulFetch.runtime.pin('a', successfulFetch.sign);
		const newAccount = event([['e', 'b']], 2, other);
		successfulFetch.runtime.initialize(other, newAccount);
		latest.resolve(event([['e', 'old-account']], 10));
		await flush();
		expect(successfulFetch.runtime.canonical).toBe(newAccount);
		expect(successfulFetch.sign).not.toHaveBeenCalled();

		const fetching = setup();
		const request = deferred<Event | undefined>();
		fetching.fetchLatest.mockImplementationOnce(() => request.promise);
		fetching.runtime.pin('a', fetching.sign);
		fetching.runtime.initialize(other, event([['e', 'b']], 2, other));
		request.reject(new Error('old account offline'));
		await flush();
		expect(fetching.runtime.owner).toBe(other);
		expect(fetching.runtime.effectivePinnedEventIds).toEqual(['b']);
		expect(fetching.runtime.failure).toBeUndefined();
		expect(fetching.sign).not.toHaveBeenCalled();

		const signing = setup();
		const signature = deferred<Event>();
		signing.sign.mockImplementationOnce(() => signature.promise);
		signing.runtime.pin('a', signing.sign);
		await flush();
		signing.runtime.initialize(other);
		signature.resolve(event([['e', 'a']], 10));
		await flush();
		expect(signing.publications).toHaveLength(0);
		expect(signing.runtime.owner).toBe(other);

		const publishing = setup();
		publishing.runtime.pin('a', publishing.sign);
		await flush();
		publishing.runtime.reset();
		publishing.publications[0].resolve();
		await flush();
		expect(publishing.runtime.owner).toBeUndefined();
		expect(publishing.runtime.canonical).toBeUndefined();
		expect(publishing.runtime.failure).toBeUndefined();
		expect(publishing.cache).not.toHaveBeenCalled();
	});

	it('does not sign after account reset during the same-second wait', async () => {
		const s = setup(event([['e', 'old']], 10));
		s.runtime.pin('mine', s.sign);
		await flush();
		expect(s.waits).toHaveLength(1);
		s.runtime.reset();
		s.advance();
		await s.resolveWait();
		expect(s.sign).not.toHaveBeenCalled();
		expect(s.runtime.owner).toBeUndefined();
		expect(s.runtime.failure).toBeUndefined();
	});
});
