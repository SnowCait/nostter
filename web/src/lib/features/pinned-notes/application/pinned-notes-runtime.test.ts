import { describe, expect, it, vi } from 'vitest';
import type { Event, EventTemplate } from 'nostr-tools';
import { PinnedNotesRuntime, type PinSaveFailure } from './pinned-notes-runtime.svelte';

const owner = 'a'.repeat(64);
const other = 'b'.repeat(64);
const author = 'c'.repeat(64);

function note(id: string) {
	return { id, pubkey: author };
}

function pinTag(id: string, relayHint = '') {
	return ['e', id, relayHint, author];
}

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
	const second = 10;
	const publications: ReturnType<typeof deferred<void>>[] = [];
	const templates: EventTemplate[] = [];
	const fetchLatest = vi.fn(async (): Promise<Event | undefined> => undefined);
	const publish = vi.fn(() => {
		const next = deferred<void>();
		publications.push(next);
		return next.promise;
	});
	const cache = vi.fn(async () => true);
	const getRelayHint = vi.fn<(eventId: string) => string | undefined>(() => undefined);
	const sign = vi.fn(async (template: EventTemplate) => {
		templates.push(template);
		return { ...event(template.tags, template.created_at), content: template.content };
	});
	const runtime = new PinnedNotesRuntime({
		fetchLatest,
		sign,
		publish,
		now: () => second,
		cache,
		getRelayHint
	});
	runtime.initialize(owner, initial);
	const failures: PinSaveFailure[] = [];
	runtime.onSaveFailure((failure) => failures.push(failure));
	return {
		runtime,
		failures,
		sign,
		fetchLatest,
		publish,
		cache,
		getRelayHint,
		templates,
		publications
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
		s.runtime.pin(note('c'));
		expect(s.runtime.phase).toBe('fetching');
		expect(s.runtime.inFlight).toEqual([
			{ type: 'pin', eventId: 'c', authorPubkey: author, relayHint: undefined }
		]);
		expect(s.runtime.effectivePinnedEventIds).toEqual(['c']);
		expect(s.fetchLatest).toHaveBeenCalledWith(owner);
		expect(s.sign).not.toHaveBeenCalled();
		fetching.resolve(latest);
		await flush();
		expect(s.runtime.canonical).toBe(latest);
		expect(s.templates[0].created_at).toBe(10);
		expect(s.templates[0]).toMatchObject({
			kind: 10001,
			content: 'remote encrypted pins',
			tags: [['e', 'a'], ['e', 'b'], pinTag('c')]
		});
		s.publications[0].resolve();
		await flush();
		expect(s.runtime.canonical?.tags).toEqual([['e', 'a'], ['e', 'b'], pinTag('c')]);
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
		s.runtime.pin(note('mine'));
		s.runtime.unpin('local');
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
		s.runtime.pin(note('mine'));
		await flush();
		expect(s.runtime.canonical).toBe(local);
		expect(s.templates[0].tags).toEqual([['e', 'local'], pinTag('mine')]);
		s.publications[0].resolve();
		await flush();
		expect(s.runtime.effectivePinnedEventIds).toEqual(['local', 'mine']);
	});

	it('uses local canonical or an empty list when relays have no event', async () => {
		const s = setup(event([['e', 'local']], 1));
		s.runtime.pin(note('mine'));
		await flush();
		expect(s.templates[0].tags).toEqual([['e', 'local'], pinTag('mine')]);
		const t = setup();
		t.runtime.pin(note('mine'));
		await flush();
		expect(t.templates[0].tags).toEqual([pinTag('mine')]);
		expect(t.templates[0].content).toBe('');
	});

	it('rolls back fetch failure without signing or publishing', async () => {
		const s = setup(event([['e', 'old']]));
		const fetching = deferred<Event | undefined>();
		s.fetchLatest.mockImplementationOnce(() => fetching.promise);
		s.runtime.pin(note('mine'));
		s.runtime.unpin('old');
		fetching.reject(new Error('offline'));
		await flush();
		expect(s.runtime.effectivePinnedEventIds).toEqual(['old']);
		expect(s.runtime.inFlight).toEqual([]);
		expect(s.runtime.pending).toEqual([]);
		expect(s.runtime.phase).toBe('idle');
		expect(s.failures).toEqual([{ stage: 'fetching', error: new Error('offline') }]);
		expect(s.sign).not.toHaveBeenCalled();
		expect(s.publications).toHaveLength(0);
	});

	it('keeps signing and publishing additions pending, then combines them after success', async () => {
		const s = setup();
		const signing = deferred<Event>();
		s.sign.mockImplementationOnce(() => signing.promise);
		s.runtime.pin(note('a'));
		await flush();
		s.runtime.pin(note('b'));
		expect(s.runtime.pending).toHaveLength(1);
		signing.resolve(event([['e', 'a']], 10));
		await flush();
		s.runtime.unpin('a');
		expect(s.runtime.pending).toHaveLength(2);
		expect(s.runtime.effectivePinnedEventIds).toEqual(['b']);
		s.publications[0].resolve();
		await flush();
		expect(s.runtime.effectivePinnedEventIds).toEqual(['b']);
		expect(s.fetchLatest).toHaveBeenCalledTimes(2);
		expect(s.sign).toHaveBeenCalledTimes(2);
		expect(s.templates[0].tags).toEqual([pinTag('b')]);
		expect(s.templates[0].created_at).toBe(11);
		s.publications[1].resolve();
		await flush();
		expect(s.runtime.canonical?.tags).toEqual([pinTag('b')]);
	});

	it('increments the timestamp when the base matches local time', async () => {
		const s = setup(event([['e', 'old']], 10));
		s.runtime.pin(note('new'));
		await flush();
		expect(s.templates[0].created_at).toBe(11);
		expect(s.runtime.effectivePinnedEventIds).toEqual(['old', 'new']);
		expect(s.sign).toHaveBeenCalledOnce();
	});

	it('signs and publishes after a future fetched base', async () => {
		const s = setup();
		s.fetchLatest.mockResolvedValueOnce(event([['e', 'future']], 20));
		s.runtime.pin(note('mine'));
		await flush();
		expect(s.runtime.canonical?.tags).toEqual([['e', 'future']]);
		expect(s.templates[0].created_at).toBe(21);
		expect(s.publish).toHaveBeenCalledOnce();
		s.publications[0].resolve();
		await flush();
		expect(s.failures).toEqual([]);
	});

	it('treats relay rejection of a future-derived timestamp as a publish failure', async () => {
		const s = setup();
		s.fetchLatest.mockResolvedValueOnce(event([['e', 'future']], 20));
		s.runtime.pin(note('mine'));
		await flush();
		expect(s.templates[0].created_at).toBe(21);
		s.publications[0].reject(new Error('timestamp rejected by relay'));
		await flush();
		expect(s.failures.map(({ stage }) => stage)).toEqual(['publishing']);
	});

	it('rolls back signing failure and rejects a wrong signing owner', async () => {
		const s = setup(event([['e', 'old']]));
		const signing = deferred<Event>();
		s.sign.mockImplementationOnce(() => signing.promise);
		s.runtime.pin(note('new'));
		await flush();
		s.runtime.unpin('old');
		signing.reject(new Error('Signing is unavailable'));
		await flush();
		expect(s.runtime.effectivePinnedEventIds).toEqual(['old']);
		expect(s.runtime.pending).toEqual([]);
		expect(s.failures.map(({ stage }) => stage)).toEqual(['signing']);
		s.runtime.pin(note('again'));
		await flush();
		expect(s.sign.mock.calls.map(([template]) => template.created_at)).toEqual([10, 10]);
		const t = setup();
		t.sign.mockResolvedValueOnce(event([['e', 'a']], 10, other));
		t.runtime.pin(note('a'));
		await flush();
		expect(t.publications).toHaveLength(0);
		expect(t.cache).not.toHaveBeenCalled();
		expect(t.failures.map(({ stage }) => stage)).toEqual(['signing']);
		t.runtime.pin(note('b'));
		await flush();
		expect(t.sign.mock.calls.map(([template]) => template.created_at)).toEqual([10, 10]);
		expect(t.publications).toHaveLength(1);
		expect(t.failures).toHaveLength(1);
	});

	it('rolls back a publish failure with no pending operation', async () => {
		const s = setup();
		s.runtime.pin(note('a'));
		await flush();
		s.publications[0].reject(new Error('relay'));
		await flush();
		expect(s.runtime.effectivePinnedEventIds).toEqual([]);
		expect(s.failures).toEqual([{ stage: 'publishing', error: new Error('relay') }]);
	});

	it('refetches and retries one merged snapshot after a publish failure with pending', async () => {
		const s = setup();
		s.fetchLatest
			.mockResolvedValueOnce(undefined)
			.mockResolvedValueOnce(event([['e', 'remote']], 8));
		s.runtime.pin(note('a'));
		await flush();
		s.runtime.pin(note('b'));
		s.publications[0].reject(new Error('relay'));
		await flush();
		expect(s.failures).toEqual([]);
		expect(s.runtime.inFlight).toHaveLength(2);
		expect(s.fetchLatest).toHaveBeenCalledTimes(2);
		expect(s.templates[1].tags).toEqual([['e', 'remote'], pinTag('a'), pinTag('b')]);
		expect(s.templates[0].created_at).toBe(10);
		expect(s.templates[1].created_at).toBe(11);
		expect(s.sign).toHaveBeenCalledTimes(2);
		s.publications[1].resolve();
		await flush();
		expect(s.runtime.canonical?.tags).toEqual([['e', 'remote'], pinTag('a'), pinTag('b')]);
		expect(s.failures).toEqual([]);
	});

	it('keeps author and relay hints of pins through pending, rebase, and merged retry', async () => {
		const s = setup();
		const hints: Record<string, string> = { a: 'wss://a.example', x: 'wss://x.example' };
		s.getRelayHint.mockImplementation((id: string) => hints[id]);
		s.fetchLatest.mockResolvedValueOnce(undefined).mockResolvedValueOnce(
			event(
				[
					['e', 'x'],
					['t', 'topic']
				],
				8
			)
		);
		s.runtime.pin(note('a'));
		await flush();
		s.runtime.pin(note('b'));
		s.runtime.unpin('x');
		s.runtime.pin(note('x'));
		s.publications[0].reject(new Error('relay'));
		await flush();
		const tags = [
			['t', 'topic'],
			pinTag('a', 'wss://a.example'),
			pinTag('b'),
			pinTag('x', 'wss://x.example')
		];
		expect(s.templates[1].tags).toEqual(tags);
		s.publications[1].resolve();
		await flush();
		expect(s.runtime.canonical?.tags).toEqual(tags);
	});

	it('stops after the merged retry fails', async () => {
		const s = setup();
		s.runtime.pin(note('a'));
		await flush();
		s.runtime.pin(note('b'));
		s.publications[0].reject(new Error('relay'));
		await flush();
		expect(s.failures).toEqual([]);
		s.publications[1].reject(new Error('relay again'));
		await flush();
		expect(s.runtime.effectivePinnedEventIds).toEqual([]);
		expect(s.failures).toEqual([{ stage: 'publishing', error: new Error('relay again') }]);
		expect(s.sign).toHaveBeenCalledTimes(2);
		expect(s.fetchLatest).toHaveBeenCalledTimes(2);
	});

	it('treats cache false or rejection as best effort after relay acceptance', async () => {
		const s = setup();
		s.cache.mockResolvedValueOnce(false);
		s.runtime.pin(note('a'));
		await flush();
		s.publications[0].resolve();
		await flush();
		expect(s.runtime.canonical?.tags).toEqual([pinTag('a')]);
		expect(s.runtime.phase).toBe('idle');
		expect(s.failures).toEqual([]);
		const t = setup();
		const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
		try {
			t.cache.mockRejectedValueOnce(new Error('cache unavailable'));
			t.runtime.pin(note('a'));
			await flush();
			t.publications[0].resolve();
			await flush();
			expect(t.runtime.canonical?.tags).toEqual([pinTag('a')]);
			expect(t.runtime.phase).toBe('idle');
			expect(t.failures).toEqual([]);
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
		s.runtime.pin(note('a'));
		await flush();
		s.runtime.pin(note('b'));
		s.publications[0].resolve();
		await flush();
		expect(s.fetchLatest).toHaveBeenCalledTimes(2);
		expect(s.runtime.effectivePinnedEventIds).toEqual(['a', 'b']);
		expect(s.publications).toHaveLength(2);
		cacheWrite.resolve(false);
		s.publications[1].resolve();
		await flush();
		expect(s.runtime.canonical?.tags).toEqual([pinTag('a'), pinTag('b')]);
	});

	it('ignores stale fetch, sign, and publish completions after account switches or reset', async () => {
		const successfulFetch = setup();
		const latest = deferred<Event | undefined>();
		successfulFetch.fetchLatest.mockImplementationOnce(() => latest.promise);
		successfulFetch.runtime.pin(note('a'));
		const newAccount = event([['e', 'b']], 2, other);
		successfulFetch.runtime.initialize(other, newAccount);
		latest.resolve(event([['e', 'old-account']], 10));
		await flush();
		expect(successfulFetch.runtime.canonical).toBe(newAccount);
		expect(successfulFetch.sign).not.toHaveBeenCalled();

		const fetching = setup();
		const request = deferred<Event | undefined>();
		fetching.fetchLatest.mockImplementationOnce(() => request.promise);
		fetching.runtime.pin(note('a'));
		fetching.runtime.initialize(other, event([['e', 'b']], 2, other));
		request.reject(new Error('old account offline'));
		await flush();
		expect(fetching.runtime.owner).toBe(other);
		expect(fetching.runtime.effectivePinnedEventIds).toEqual(['b']);
		expect(fetching.failures).toEqual([]);
		expect(fetching.sign).not.toHaveBeenCalled();

		const signing = setup();
		const signature = deferred<Event>();
		signing.sign.mockImplementationOnce(() => signature.promise);
		signing.runtime.pin(note('a'));
		await flush();
		signing.runtime.initialize(other);
		signature.resolve(event([['e', 'a']], 10));
		await flush();
		expect(signing.publications).toHaveLength(0);
		expect(signing.runtime.owner).toBe(other);
		signing.sign.mockImplementationOnce(async (template) => ({
			...event(template.tags, template.created_at, other),
			content: template.content
		}));
		signing.runtime.pin(note('b'));
		await flush();
		expect(signing.sign.mock.calls[1][0].created_at).toBe(10);
		expect(signing.publications).toHaveLength(1);

		const failedSigning = setup();
		const failedSignature = deferred<Event>();
		failedSigning.sign.mockImplementationOnce(() => failedSignature.promise);
		failedSigning.runtime.pin(note('a'));
		await flush();
		failedSigning.runtime.initialize(other);
		failedSignature.reject(new Error('old account signer'));
		await flush();
		expect(failedSigning.failures).toEqual([]);

		const publishing = setup();
		publishing.runtime.pin(note('a'));
		await flush();
		publishing.runtime.reset();
		publishing.publications[0].resolve();
		await flush();
		expect(publishing.runtime.owner).toBeUndefined();
		expect(publishing.runtime.canonical).toBeUndefined();
		expect(publishing.failures).toEqual([]);
		expect(publishing.cache).not.toHaveBeenCalled();

		const failedPublishing = setup();
		failedPublishing.runtime.pin(note('a'));
		await flush();
		failedPublishing.runtime.reset();
		failedPublishing.publications[0].reject(new Error('old account relay'));
		await flush();
		expect(failedPublishing.failures).toEqual([]);
	});

	it('delivers save failures to listeners until they unsubscribe', async () => {
		const s = setup();
		const listener = vi.fn();
		const unsubscribe = s.runtime.onSaveFailure(listener);
		s.fetchLatest.mockRejectedValueOnce(new Error('offline'));
		s.runtime.pin(note('a'));
		await flush();
		expect(listener).toHaveBeenCalledExactlyOnceWith({
			stage: 'fetching',
			error: new Error('offline')
		});
		unsubscribe();
		s.fetchLatest.mockRejectedValueOnce(new Error('offline again'));
		s.runtime.pin(note('b'));
		await flush();
		expect(listener).toHaveBeenCalledOnce();
		expect(s.failures).toHaveLength(2);
	});
});
