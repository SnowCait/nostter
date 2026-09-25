import { describe, expect, it } from 'vitest';
import type { Event } from 'nostr-tools';
import { prepareRegularMuteState } from '../domain/mute-state';
import { RegularMuteRuntime } from './regular-mute-state.svelte';

const accountA = 'a'.repeat(64);
const accountB = 'b'.repeat(64);

function event(pubkey: string, id: string, created_at: number, tags: string[][] = []): Event {
	return { pubkey, id, created_at, tags, kind: 10000, content: id, sig: 'sig' };
}

function activate(runtime: RegularMuteRuntime, pubkey: string, source?: Event): void {
	runtime.applySnapshot(
		pubkey,
		prepareRegularMuteState(source, pubkey),
		runtime.captureInitializationBaseline()
	);
}

describe('regular mute runtime', () => {
	it('starts without an owner, switches to an explicit empty account, and resets', () => {
		const runtime = new RegularMuteRuntime();
		expect(runtime.state).toEqual({
			accountPubkey: undefined,
			regular: { event: undefined, tags: { pubkeys: [], eventIds: [], words: [] } }
		});
		activate(runtime, accountA, event(accountA, 'a', 1, [['p', 'old']]));
		activate(runtime, accountB);
		expect(runtime.state.accountPubkey).toBe(accountB);
		expect(runtime.state.regular).toEqual(prepareRegularMuteState(undefined, accountB));
		runtime.reset();
		expect(runtime.state.accountPubkey).toBeUndefined();
	});

	it('publishes event and tags together after decrypt and preserves completed state on failure', async () => {
		const runtime = new RegularMuteRuntime();
		activate(runtime, accountA, event(accountA, 'old', 1, [['p', 'old']]));
		const before = runtime.state.regular;
		const candidate = event(accountA, 'new', 2, [['p', 'public']]);
		const decrypt = Promise.withResolvers<[string[][], boolean]>();
		const observed = [] as (typeof before)[];
		runtime.subscribe(() => observed.push(runtime.state.regular));
		const pending = runtime.ingestEvent(accountA, candidate, () => decrypt.promise);
		expect(runtime.state.regular).toBe(before);
		decrypt.resolve([[['p', 'private']], false]);
		await pending;
		expect(observed).toEqual([
			{
				event: candidate,
				tags: { pubkeys: ['public', 'private'], eventIds: [], words: [] }
			}
		]);
		const completed = runtime.state.regular;
		await expect(
			runtime.ingestEvent(accountA, event(accountA, 'failed', 3), () =>
				Promise.reject(new Error('decrypt failed'))
			)
		).rejects.toThrow('decrypt failed');
		expect(runtime.state.regular).toBe(completed);
	});

	it('keeps the preferred event across overlapping decrypts', async () => {
		const runtime = new RegularMuteRuntime();
		activate(runtime, accountA);
		const older = Promise.withResolvers<[string[][], boolean]>();
		const newer = Promise.withResolvers<[string[][], boolean]>();
		const first = runtime.ingestEvent(accountA, event(accountA, 'old', 1), () => older.promise);
		const preferred = event(accountA, 'new', 2);
		const second = runtime.ingestEvent(accountA, preferred, () => newer.promise);
		newer.resolve([[['p', 'new']], false]);
		await second;
		older.resolve([[['p', 'old']], false]);
		await first;
		expect(runtime.state.regular.event).toBe(preferred);
		expect(runtime.state.regular.tags.pubkeys).toEqual(['new']);
	});

	it('ignores old account and pre-optimistic decrypt completions', async () => {
		const runtime = new RegularMuteRuntime();
		activate(runtime, accountA);
		const remote = Promise.withResolvers<[string[][], boolean]>();
		const pending = runtime.ingestEvent(
			accountA,
			event(accountA, 'remote', 1),
			() => remote.promise
		);
		const optimistic = runtime.replaceTags(accountA, [['p', 'local']]);
		remote.resolve([[['p', 'remote']], false]);
		await pending;
		expect(runtime.state.regular).toBe(optimistic);

		const oldAccount = Promise.withResolvers<[string[][], boolean]>();
		const another = runtime.ingestEvent(
			accountA,
			event(accountA, 'later', 2),
			() => oldAccount.promise
		);
		activate(runtime, accountB);
		oldAccount.resolve([[['p', 'stale']], false]);
		await another;
		expect(runtime.state.accountPubkey).toBe(accountB);
		expect(runtime.state.regular.tags.pubkeys).toEqual([]);
	});

	it('preserves live and optimistic updates against an old same-account snapshot', async () => {
		const runtime = new RegularMuteRuntime();
		activate(runtime, accountA);
		const baseline = runtime.captureInitializationBaseline();
		await runtime.ingestEvent(accountA, event(accountA, 'live', 2, [['p', 'live']]));
		runtime.applySnapshot(
			accountA,
			prepareRegularMuteState(event(accountA, 'snapshot', 1), accountA),
			baseline
		);
		expect(runtime.state.regular.tags.pubkeys).toEqual(['live']);

		const optimisticBaseline = runtime.captureInitializationBaseline();
		const previous = runtime.state.regular;
		const optimistic = runtime.replaceTags(accountA, [['p', 'local']]);
		runtime.applySnapshot(
			accountA,
			prepareRegularMuteState(event(accountA, 'newer', 3), accountA),
			optimisticBaseline
		);
		expect(runtime.state.regular).toBe(optimistic);
		runtime.restore(accountA, previous, optimistic!);
		expect(runtime.state.regular).toBe(previous);
	});

	it('does not let an initialization snapshot displace a newer pending live candidate', async () => {
		const runtime = new RegularMuteRuntime();
		activate(runtime, accountA);
		const baseline = runtime.captureInitializationBaseline();
		const decrypt = Promise.withResolvers<[string[][], boolean]>();
		const live = event(accountA, 'live', 2);
		const pending = runtime.ingestEvent(accountA, live, () => decrypt.promise);
		runtime.applySnapshot(
			accountA,
			prepareRegularMuteState(event(accountA, 'snapshot', 1), accountA),
			baseline
		);
		expect(runtime.state.regular.event).toBeUndefined();
		decrypt.resolve([[['p', 'live']], false]);
		await pending;
		expect(runtime.state.regular.event).toBe(live);
	});

	it('rejects old initialization and decrypt completion after reset', async () => {
		const runtime = new RegularMuteRuntime();
		activate(runtime, accountA);
		const baseline = runtime.captureInitializationBaseline();
		const decrypt = Promise.withResolvers<[string[][], boolean]>();
		const pending = runtime.ingestEvent(
			accountA,
			event(accountA, 'pending', 1),
			() => decrypt.promise
		);
		runtime.reset();
		runtime.applySnapshot(
			accountA,
			prepareRegularMuteState(event(accountA, 'snapshot', 2), accountA),
			baseline
		);
		decrypt.resolve([[['p', 'stale']], false]);
		await pending;
		expect(runtime.state.accountPubkey).toBeUndefined();
		expect(runtime.state.regular.event).toBeUndefined();
	});
});
