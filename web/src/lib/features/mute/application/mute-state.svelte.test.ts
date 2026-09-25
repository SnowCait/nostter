import { describe, expect, it, vi } from 'vitest';
import type { Event } from 'nostr-tools';
import { Mute, type MuteSnapshot } from './mute-state.svelte';
import { prepareKindMuteState, prepareRegularMuteState } from '../domain/mute-state';

const accountA = 'a'.repeat(64);
const accountB = 'b'.repeat(64);

function event(
	kind: number,
	id: string,
	created_at: number,
	tags: string[][] = [],
	pubkey = accountA
): Event {
	return { kind, id, created_at, tags, pubkey, content: id, sig: 'sig' };
}

function snapshot(
	accountPubkey: string,
	regularEvent?: Event,
	kindEvents: [number, Event][] = []
): MuteSnapshot {
	return {
		regular: prepareRegularMuteState(regularEvent, accountPubkey),
		byKind: new Map(kindEvents.map(([kind, source]) => [kind, prepareKindMuteState(source)]))
	};
}

function activate(mute: Mute, accountPubkey: string, state = snapshot(accountPubkey)): void {
	mute.applySnapshot(accountPubkey, state, mute.captureInitializationBaseline());
}

describe('account-scoped mute state', () => {
	it('starts empty and replaces both mute lists on account switch or reset', () => {
		const mute = new Mute();
		expect(mute.state).toEqual({
			accountPubkey: undefined,
			regular: { event: undefined, tags: { pubkeys: [], eventIds: [], words: [] } },
			byKind: new Map()
		});
		const regular = event(10000, 'aa', 1, [['p', 'muted']]);
		const kind = event(30007, 'bb', 1, [
			['d', '6'],
			['p', 'muted']
		]);
		activate(mute, accountA, snapshot(accountA, regular, [[6, kind]]));
		activate(mute, accountB);
		expect(mute.state.accountPubkey).toBe(accountB);
		expect(mute.state.regular.event).toBeUndefined();
		expect(mute.state.regular.tags.pubkeys).toEqual([]);
		expect(mute.state.byKind.size).toBe(0);
		mute.reset();
		expect(mute.state.accountPubkey).toBeUndefined();
	});

	it('publishes regular event and tags together after decrypt, and keeps the old value on failure', async () => {
		const mute = new Mute();
		const old = event(10000, 'bb', 1, [['p', 'old']]);
		activate(mute, accountA, snapshot(accountA, old));
		const baseline = mute.state.regular;
		const candidate = event(10000, 'aa', 2, [['p', 'public']]);
		const decrypt = Promise.withResolvers<[string[][], boolean]>();
		const pending = mute.ingestRegularEvent(accountA, candidate, () => decrypt.promise);
		expect(mute.state.regular).toBe(baseline);
		decrypt.resolve([[['p', 'private']], false]);
		await pending;
		expect(mute.state.regular).toEqual({
			event: candidate,
			tags: { pubkeys: ['public', 'private'], eventIds: [], words: [] }
		});
		const completed = mute.state.regular;
		const failure = new Error('decrypt failed');
		await expect(
			mute.ingestRegularEvent(accountA, event(10000, 'aa', 3), () => Promise.reject(failure))
		).rejects.toBe(failure);
		expect(mute.state.regular).toBe(completed);
	});

	it('rejects stale candidates and accepts the lower event id at the same timestamp', async () => {
		const mute = new Mute();
		activate(mute, accountA, snapshot(accountA, event(10000, 'bb', 2)));
		const decrypt = vi.fn().mockResolvedValue([[], false]);
		await mute.ingestRegularEvent(accountA, event(10000, 'aa', 1), decrypt);
		await mute.ingestRegularEvent(accountA, event(10000, 'cc', 2), decrypt);
		expect(decrypt).not.toHaveBeenCalled();
		const preferred = event(10000, 'aa', 2);
		await mute.ingestRegularEvent(accountA, preferred, decrypt);
		expect(mute.state.regular.event).toBe(preferred);
	});

	it.each(['older-first', 'preferred-first'])(
		'keeps the preferred overlapping regular event (%s)',
		async (order) => {
			const mute = new Mute();
			activate(mute, accountA);
			const older = event(10000, 'bb', 1);
			const preferred = event(10000, 'aa', 2);
			const olderDecrypt = Promise.withResolvers<[string[][], boolean]>();
			const preferredDecrypt = Promise.withResolvers<[string[][], boolean]>();
			const decrypt = (_pubkey: string, content: string) =>
				content === older.id ? olderDecrypt.promise : preferredDecrypt.promise;
			const first = mute.ingestRegularEvent(accountA, older, decrypt);
			const second = mute.ingestRegularEvent(accountA, preferred, decrypt);
			if (order === 'older-first') {
				olderDecrypt.resolve([[['p', 'older']], false]);
				await first;
				preferredDecrypt.resolve([[['p', 'preferred']], false]);
				await second;
			} else {
				preferredDecrypt.resolve([[['p', 'preferred']], false]);
				await second;
				olderDecrypt.resolve([[['p', 'older']], false]);
				await first;
			}
			expect(mute.state.regular.event).toBe(preferred);
			expect(mute.state.regular.tags.pubkeys).toEqual(['preferred']);
		}
	);

	it('discards old-account and pre-optimistic decrypt completions', async () => {
		const mute = new Mute();
		activate(mute, accountA);
		const decrypt = Promise.withResolvers<[string[][], boolean]>();
		const pending = mute.ingestRegularEvent(
			accountA,
			event(10000, 'aa', 1),
			() => decrypt.promise
		);
		const optimistic = mute.replaceRegularTags(accountA, [['p', 'optimistic']]);
		decrypt.resolve([[['p', 'remote']], false]);
		await pending;
		expect(mute.state.regular).toBe(optimistic);

		const another = Promise.withResolvers<[string[][], boolean]>();
		const oldAccount = mute.ingestRegularEvent(
			accountA,
			event(10000, 'aa', 2),
			() => another.promise
		);
		activate(mute, accountB);
		another.resolve([[['p', 'old-account']], false]);
		await oldAccount;
		expect(mute.state.accountPubkey).toBe(accountB);
		expect(mute.state.regular.tags.pubkeys).toEqual([]);
	});

	it('applies different kinds independently with immutable Map and Set replacement', async () => {
		const mute = new Mute();
		activate(mute, accountA);
		const initialMap = mute.state.byKind;
		const firstEvent = event(30007, 'aa', 1, [
			['d', '6'],
			['p', 'public-six']
		]);
		const secondEvent = event(30007, 'bb', 1, [
			['d', '7'],
			['p', 'public-seven']
		]);
		const six = Promise.withResolvers<[string[][], boolean]>();
		const seven = Promise.withResolvers<[string[][], boolean]>();
		const decrypt = (_pubkey: string, content: string) =>
			content === firstEvent.id ? six.promise : seven.promise;
		const first = mute.ingestKindEvent(accountA, firstEvent, decrypt);
		const second = mute.ingestKindEvent(accountA, secondEvent, decrypt);
		seven.resolve([[['p', 'private-seven']], false]);
		await second;
		const mapAfterSeven = mute.state.byKind;
		six.resolve([[['p', 'private-six']], false]);
		await first;
		expect(mute.state.byKind).not.toBe(initialMap);
		expect(mute.state.byKind).not.toBe(mapAfterSeven);
		expect(mapAfterSeven.has(6)).toBe(false);
		expect(mute.state.byKind.get(6)?.pubkeys).toEqual(new Set(['public-six', 'private-six']));
		expect(mute.state.byKind.get(7)?.pubkeys).toEqual(
			new Set(['public-seven', 'private-seven'])
		);
	});

	it('discards stale same-kind and old-account results while preserving public tags on decrypt failure', async () => {
		const mute = new Mute();
		activate(mute, accountA);
		const stale = event(30007, 'bb', 1, [
			['d', '6'],
			['p', 'stale']
		]);
		const preferred = event(30007, 'aa', 1, [
			['d', '6'],
			['p', 'public']
		]);
		const deferred = Promise.withResolvers<[string[][], boolean]>();
		const first = mute.ingestKindEvent(accountA, stale, () => deferred.promise);
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		await mute.ingestKindEvent(accountA, preferred, () =>
			Promise.reject(new Error('decrypt failed'))
		);
		deferred.resolve([[['p', 'stale-private']], false]);
		await first;
		expect(mute.state.byKind.get(6)?.event).toBe(preferred);
		expect(mute.state.byKind.get(6)?.pubkeys).toEqual(new Set(['public']));
		expect(warn).toHaveBeenCalledOnce();
		warn.mockRestore();
		const oldAccount = Promise.withResolvers<[string[][], boolean]>();
		const pending = mute.ingestKindEvent(
			accountA,
			event(30007, 'aa', 2, [['d', '6']]),
			() => oldAccount.promise
		);
		activate(mute, accountB);
		oldAccount.resolve([[['p', 'old']], false]);
		await pending;
		expect(mute.state.byKind.size).toBe(0);
	});

	it('does not let a pending kind decrypt replace a local completed update', async () => {
		const mute = new Mute();
		const initial = event(30007, 'bb', 1, [
			['d', '6'],
			['p', 'initial']
		]);
		activate(mute, accountA, snapshot(accountA, undefined, [[6, initial]]));
		const previous = mute.state.byKind.get(6);
		const deferred = Promise.withResolvers<[string[][], boolean]>();
		const pending = mute.ingestKindEvent(
			accountA,
			event(30007, 'aa', 2, [
				['d', '6'],
				['p', 'remote']
			]),
			() => deferred.promise
		);
		const local = prepareKindMuteState(
			event(30007, 'aa', 3, [
				['d', '6'],
				['p', 'local']
			])
		);
		mute.replaceKind(accountA, 6, local);
		deferred.resolve([[['p', 'remote-private']], false]);
		await pending;
		expect(mute.state.byKind.get(6)).toBe(local);
		expect(previous?.pubkeys).toEqual(new Set(['initial']));
	});

	it('merges same-account snapshots per completed entry and protects in-flight work', async () => {
		const mute = new Mute();
		activate(mute, accountA);
		const baseline = mute.captureInitializationBaseline();
		const regularLive = event(10000, 'aa', 3, [['p', 'live']]);
		await mute.ingestRegularEvent(accountA, regularLive);
		const kindLive = event(30007, 'aa', 3, [
			['d', '6'],
			['p', 'live-six']
		]);
		await mute.ingestKindEvent(accountA, kindLive);
		const fetchedRegular = event(10000, 'bb', 2, [['p', 'fetched']]);
		const fetchedSix = event(30007, 'bb', 2, [
			['d', '6'],
			['p', 'fetched-six']
		]);
		const fetchedSeven = event(30007, 'bb', 2, [
			['d', '7'],
			['p', 'fetched-seven']
		]);
		mute.applySnapshot(
			accountA,
			snapshot(accountA, fetchedRegular, [
				[6, fetchedSix],
				[7, fetchedSeven]
			]),
			baseline
		);
		expect(mute.state.regular.event).toBe(regularLive);
		expect(mute.state.byKind.get(6)?.event).toBe(kindLive);
		expect(mute.state.byKind.get(7)?.event).toBe(fetchedSeven);

		const optimisticBaseline = mute.captureInitializationBaseline();
		const optimistic = mute.replaceRegularTags(accountA, [['p', 'optimistic']]);
		mute.applySnapshot(accountA, snapshot(accountA, event(10000, 'aa', 4)), optimisticBaseline);
		expect(mute.state.regular).toBe(optimistic);

		const inFlightBaseline = mute.captureInitializationBaseline();
		const decrypt = Promise.withResolvers<[string[][], boolean]>();
		const pending = mute.ingestRegularEvent(
			accountA,
			event(10000, 'aa', 5),
			() => decrypt.promise
		);
		mute.applySnapshot(accountA, snapshot(accountA, event(10000, 'aa', 4)), inFlightBaseline);
		expect(mute.state.regular).toBe(optimistic);
		decrypt.resolve([[['p', 'completed']], false]);
		await pending;
		expect(mute.state.regular.tags.pubkeys).toEqual(['completed']);
	});

	it('keeps an in-flight kind update while applying an independent kind from initialization', async () => {
		const mute = new Mute();
		activate(mute, accountA);
		const baseline = mute.captureInitializationBaseline();
		const liveSix = event(30007, 'aa', 3, [
			['d', '6'],
			['p', 'live-six']
		]);
		const decrypt = Promise.withResolvers<[string[][], boolean]>();
		const pending = mute.ingestKindEvent(accountA, liveSix, () => decrypt.promise);
		const fetchedSix = event(30007, 'bb', 2, [
			['d', '6'],
			['p', 'fetched-six']
		]);
		const fetchedSeven = event(30007, 'bb', 2, [
			['d', '7'],
			['p', 'fetched-seven']
		]);
		mute.applySnapshot(
			accountA,
			snapshot(accountA, undefined, [
				[6, fetchedSix],
				[7, fetchedSeven]
			]),
			baseline
		);
		expect(mute.state.byKind.has(6)).toBe(false);
		expect(mute.state.byKind.get(7)?.event).toBe(fetchedSeven);
		decrypt.resolve([[], false]);
		await pending;
		expect(mute.state.byKind.get(6)?.event).toBe(liveSix);
		expect(mute.state.byKind.get(7)?.event).toBe(fetchedSeven);
	});

	it.each([
		{
			name: 'newer snapshot timestamp',
			pendingId: 'bb',
			pendingAt: 2,
			snapshotId: 'cc',
			snapshotAt: 3,
			winner: 'snapshot'
		},
		{
			name: 'lower snapshot id at equal timestamp',
			pendingId: 'bb',
			pendingAt: 2,
			snapshotId: 'aa',
			snapshotAt: 2,
			winner: 'snapshot'
		},
		{
			name: 'newer pending timestamp',
			pendingId: 'cc',
			pendingAt: 3,
			snapshotId: 'bb',
			snapshotAt: 2,
			winner: 'pending'
		},
		{
			name: 'lower pending id at equal timestamp',
			pendingId: 'aa',
			pendingAt: 2,
			snapshotId: 'bb',
			snapshotAt: 2,
			winner: 'pending'
		}
	])(
		'resolves regular snapshot against an in-flight candidate: $name',
		async ({ pendingId, pendingAt, snapshotId, snapshotAt, winner }) => {
			const mute = new Mute();
			activate(mute, accountA, snapshot(accountA, event(10000, 'current', 1)));
			const live = event(10000, pendingId, pendingAt, [['p', 'live']]);
			const fetched = event(10000, snapshotId, snapshotAt, [['p', 'snapshot']]);
			const decrypt = Promise.withResolvers<[string[][], boolean]>();
			const pending = mute.ingestRegularEvent(accountA, live, () => decrypt.promise);
			const baseline = mute.captureInitializationBaseline();

			mute.applySnapshot(accountA, snapshot(accountA, fetched), baseline);
			expect(mute.state.regular.event).toBe(
				winner === 'snapshot' ? fetched : baseline.regular.event
			);
			decrypt.resolve([[['p', 'private-live']], false]);
			await pending;
			expect(mute.state.regular.event).toBe(winner === 'snapshot' ? fetched : live);
			expect(mute.state.regular.tags.pubkeys).toEqual(
				winner === 'snapshot' ? ['snapshot'] : ['live', 'private-live']
			);
		}
	);

	it.each([
		{
			name: 'timestamps',
			sixPending: ['aa', 3] as const,
			sixSnapshot: ['bb', 2] as const,
			sevenPending: ['bb', 2] as const,
			sevenSnapshot: ['aa', 3] as const
		},
		{
			name: 'event IDs at equal timestamps',
			sixPending: ['aa', 2] as const,
			sixSnapshot: ['bb', 2] as const,
			sevenPending: ['bb', 2] as const,
			sevenSnapshot: ['aa', 2] as const
		}
	])(
		'merges kinds independently by $name while decrypts are pending',
		async ({ sixPending, sixSnapshot, sevenPending, sevenSnapshot }) => {
			const mute = new Mute();
			const currentSix = event(30007, 'current-six', 1, [['d', '6']]);
			const currentSeven = event(30007, 'current-seven', 1, [['d', '7']]);
			activate(
				mute,
				accountA,
				snapshot(accountA, undefined, [
					[6, currentSix],
					[7, currentSeven]
				])
			);
			const liveSix = event(30007, sixPending[0], sixPending[1], [
				['d', '6'],
				['p', 'live-six']
			]);
			const liveSeven = event(30007, sevenPending[0], sevenPending[1], [
				['d', '7'],
				['p', 'live-seven']
			]);
			const fetchedSix = event(30007, sixSnapshot[0], sixSnapshot[1], [
				['d', '6'],
				['p', 'snapshot-six']
			]);
			const fetchedSeven = event(30007, sevenSnapshot[0], sevenSnapshot[1], [
				['d', '7'],
				['p', 'snapshot-seven']
			]);
			const decryptSix = Promise.withResolvers<[string[][], boolean]>();
			const decryptSeven = Promise.withResolvers<[string[][], boolean]>();
			const pendingSix = mute.ingestKindEvent(accountA, liveSix, () => decryptSix.promise);
			const pendingSeven = mute.ingestKindEvent(
				accountA,
				liveSeven,
				() => decryptSeven.promise
			);
			const baseline = mute.captureInitializationBaseline();

			mute.applySnapshot(
				accountA,
				snapshot(accountA, undefined, [
					[6, fetchedSix],
					[7, fetchedSeven]
				]),
				baseline
			);
			expect(mute.state.byKind.get(6)?.event).toBe(currentSix);
			expect(mute.state.byKind.get(7)?.event).toBe(fetchedSeven);
			decryptSeven.resolve([[['p', 'private-seven']], false]);
			await pendingSeven;
			decryptSix.resolve([[['p', 'private-six']], false]);
			await pendingSix;
			expect(mute.state.byKind.get(6)?.event).toBe(liveSix);
			expect(mute.state.byKind.get(6)?.pubkeys).toEqual(new Set(['live-six', 'private-six']));
			expect(mute.state.byKind.get(7)?.event).toBe(fetchedSeven);
			expect(mute.state.byKind.get(7)?.pubkeys).toEqual(new Set(['snapshot-seven']));
		}
	);

	it('treats optimistic rollback and signed local publication as completed replacements', () => {
		const mute = new Mute();
		const source = event(10000, 'bb', 1, [['p', 'before']]);
		activate(mute, accountA, snapshot(accountA, source));
		const before = mute.state.regular;
		const optimistic = mute.replaceRegularTags(accountA, [['p', 'optimistic']]);
		expect(optimistic).not.toBe(before);
		expect(optimistic?.event).toBe(source);
		const rollback = mute.replaceRegularTags(accountA, source.tags, optimistic);
		expect(rollback).not.toBe(optimistic);
		expect(rollback?.tags.pubkeys).toEqual(['before']);
		const signed = event(10000, 'aa', 2, [['p', 'signed']]);
		mute.replaceRegularFromLocalEvent(accountA, signed, [['p', 'private']], rollback!);
		expect(mute.state.regular.event).toBe(signed);
		expect(mute.state.regular.tags.pubkeys).toEqual(['signed', 'private']);
	});

	it('ignores a same-account initialization after another account has taken ownership', () => {
		const mute = new Mute();
		activate(mute, accountA);
		const stale = mute.captureInitializationBaseline();
		activate(mute, accountB);
		mute.applySnapshot(accountA, snapshot(accountA, event(10000, 'aa', 1)), stale);
		expect(mute.state.accountPubkey).toBe(accountB);
	});

	it('does not let a stale initialization restore mute state after reset', () => {
		const mute = new Mute();
		const baseline = mute.captureInitializationBaseline();
		mute.reset();
		mute.applySnapshot(accountA, snapshot(accountA, event(10000, 'aa', 1)), baseline);
		expect(mute.state.accountPubkey).toBeUndefined();
	});
});
