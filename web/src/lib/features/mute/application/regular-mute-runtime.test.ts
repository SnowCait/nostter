import { beforeEach, describe, expect, it } from 'vitest';
import type { Event } from 'nostr-tools';
import { prepareMuteTags, prepareRegularMuteState } from '../domain/mute-state';
import { isMuteEvent } from '$lib/stores/Author';
import {
	applyRegularMuteInitialization,
	getCanonicalMuteState,
	clearOptimisticMute,
	completeLocalMute,
	ingestRemoteMute,
	getCanonicalMuteEvent,
	getEffectiveMuteTags,
	regularMuteRevision,
	resetRegularMute,
	startOptimisticMute
} from './regular-mute-runtime.svelte';

const accountA = 'a'.repeat(64);
const accountB = 'b'.repeat(64);
function event(
	id: string,
	created_at: number,
	pubkey = accountA,
	tags: string[][] = [['p', id]]
): Event {
	return { id, created_at, pubkey, kind: 10000, tags, content: 'encrypted', sig: 'sig' };
}
function initialize(owner: string, source?: Event, privateTags: string[][] = []): void {
	applyRegularMuteInitialization(
		owner,
		prepareRegularMuteState(source, owner, privateTags),
		regularMuteRevision()
	);
}
function deferredDecrypt() {
	const deferred = Promise.withResolvers<[string[][], boolean]>();
	return { deferred, decrypt: () => deferred.promise };
}

beforeEach(() => {
	resetRegularMute();
	initialize(accountA, event('P', 1, accountA, [['p', 'public-P']]), [['e', 'private-P']]);
});

describe('regular mute runtime', () => {
	it('keeps canonical event and tags separate from optimistic projections', () => {
		const token = startOptimisticMute(
			accountA,
			prepareMuteTags(
				[
					['p', 'O'],
					['word', 'O-word']
				],
				accountA
			)
		);
		expect(getCanonicalMuteState().tags).toEqual({
			pubkeys: ['public-P'],
			eventIds: ['private-P'],
			words: []
		});
		expect(getCanonicalMuteEvent()?.id).toBe('P');
		expect(getEffectiveMuteTags().pubkeys).toEqual(['O']);
		expect(getEffectiveMuteTags().eventIds).toEqual([]);
		expect(getEffectiveMuteTags().words).toEqual(['O-word']);
		(getEffectiveMuteTags().pubkeys as string[]).push('mutated');
		getCanonicalMuteEvent()?.tags.push(['p', 'mutated']);
		expect(getCanonicalMuteState().event?.tags).toEqual([['p', 'public-P']]);
		clearOptimisticMute(accountA, token);
		expect(getEffectiveMuteTags().pubkeys).toEqual(['public-P']);
	});

	it('uses effective optimistic tags when checking whether an event is muted', () => {
		const target = event('note', 1, 'O', []);
		expect(isMuteEvent(target)).toBe(false);
		const token = startOptimisticMute(accountA, prepareMuteTags([['p', 'O']], accountA));
		expect(isMuteEvent(target)).toBe(true);
		clearOptimisticMute(accountA, token);
		expect(isMuteEvent(target)).toBe(false);
	});

	it.each(['remote first', 'optimistic first'])(
		'completes remote canonical during %s ordering',
		async (order) => {
			const remote = event('R', 2);
			const { deferred, decrypt } = deferredDecrypt();
			const token =
				order === 'remote first'
					? undefined
					: startOptimisticMute(accountA, prepareMuteTags([['p', 'O']], accountA));
			const completion = ingestRemoteMute(accountA, remote, decrypt);
			const currentToken =
				token ?? startOptimisticMute(accountA, prepareMuteTags([['p', 'O']], accountA));
			deferred.resolve([[['e', 'R-private']], false]);
			await completion;
			expect(getCanonicalMuteState().event?.id).toBe('R');
			expect(getCanonicalMuteState().tags.eventIds).toEqual(['R-private']);
			expect(getEffectiveMuteTags().pubkeys).toEqual(['O']);
			clearOptimisticMute(accountA, currentToken);
			expect(getEffectiveMuteTags().pubkeys).toEqual(['R']);
		}
	);

	it('uses only the preferred overlapping remote candidate', async () => {
		const r1 = deferredDecrypt();
		const r2 = deferredDecrypt();
		const p1 = ingestRemoteMute(accountA, event('R1', 2), r1.decrypt);
		const p2 = ingestRemoteMute(accountA, event('R2', 3), r2.decrypt);
		r1.deferred.resolve([[['word', 'old']], false]);
		await p1;
		expect(getCanonicalMuteEvent()?.id).toBe('P');
		r2.deferred.resolve([[['word', 'new']], false]);
		await p2;
		expect(getCanonicalMuteEvent()?.id).toBe('R2');
		expect(getEffectiveMuteTags().words).toEqual(['new']);
	});

	it('keeps canonical state after decrypt failure and allows the same event to be retried', async () => {
		const remote = event('R', 2);
		const first = deferredDecrypt();
		const attempt = ingestRemoteMute(accountA, remote, first.decrypt);
		const failure = new Error('temporary decrypt failure');
		first.deferred.reject(failure);
		await expect(attempt).rejects.toBe(failure);
		expect(getCanonicalMuteState().event?.id).toBe('P');
		expect(getEffectiveMuteTags().pubkeys).toEqual(['public-P']);
		expect(getEffectiveMuteTags().eventIds).toEqual(['private-P']);

		await ingestRemoteMute(accountA, remote, async () => [
			[['word', 'retry succeeded']],
			false
		]);
		expect(getCanonicalMuteState().event?.id).toBe('R');
		expect(getEffectiveMuteTags().words).toEqual(['retry succeeded']);
	});

	it('does not clear a newer candidate or optimistic overlay when an older decrypt fails', async () => {
		const r1 = deferredDecrypt();
		const r2 = deferredDecrypt();
		const first = ingestRemoteMute(accountA, event('R1', 2), r1.decrypt);
		const second = ingestRemoteMute(accountA, event('R2', 3), r2.decrypt);
		const token = startOptimisticMute(accountA, prepareMuteTags([['p', 'O']], accountA));
		const failure = new Error('R1 decrypt failed');
		r1.deferred.reject(failure);
		await expect(first).rejects.toBe(failure);
		expect(getCanonicalMuteState().event?.id).toBe('P');
		expect(getEffectiveMuteTags().pubkeys).toEqual(['O']);
		r2.deferred.resolve([[['word', 'R2-private']], false]);
		await second;
		expect(getCanonicalMuteState().event?.id).toBe('R2');
		expect(getEffectiveMuteTags().pubkeys).toEqual(['O']);
		clearOptimisticMute(accountA, token);
		expect(getEffectiveMuteTags().pubkeys).toEqual(['R2']);
	});

	it('clears only its own optimistic operation after a remote update', async () => {
		const o1 = startOptimisticMute(accountA, prepareMuteTags([['p', 'O1']], accountA));
		const remote = deferredDecrypt();
		const completion = ingestRemoteMute(accountA, event('R', 2), remote.decrypt);
		const o2 = startOptimisticMute(accountA, prepareMuteTags([['p', 'O2']], accountA));
		remote.deferred.resolve([[], false]);
		await completion;
		clearOptimisticMute(accountA, o1);
		expect(getEffectiveMuteTags().pubkeys).toEqual(['O2']);
		clearOptimisticMute(accountA, o2);
		expect(getEffectiveMuteTags().pubkeys).toEqual(['R']);
	});

	it('completes a cache accepted local event without self decrypt', () => {
		const token = startOptimisticMute(accountA, prepareMuteTags([['p', 'O']], accountA));
		completeLocalMute(
			accountA,
			event('L', 2, accountA, [['p', 'public-L']]),
			[['p', 'private-L']],
			token
		);
		expect(getCanonicalMuteEvent()?.id).toBe('L');
		expect(getEffectiveMuteTags().pubkeys).toEqual(['public-L', 'private-L']);
	});

	it('does not revive an old decrypt after account switch or reset', async () => {
		const old = deferredDecrypt();
		const completion = ingestRemoteMute(accountA, event('R', 2), old.decrypt);
		startOptimisticMute(accountA, prepareMuteTags([['p', 'O']], accountA));
		initialize(accountB);
		old.deferred.resolve([[], false]);
		await completion;
		expect(getCanonicalMuteEvent()).toBeUndefined();
		expect(getEffectiveMuteTags().pubkeys).toEqual([]);
		const next = deferredDecrypt();
		const nextCompletion = ingestRemoteMute(accountB, event('B', 3, accountB), next.decrypt);
		resetRegularMute();
		next.deferred.resolve([[], false]);
		await nextCompletion;
		expect(getCanonicalMuteEvent()).toBeUndefined();
	});

	it('does not clear another account candidate or reset state after an old decrypt fails', async () => {
		const old = deferredDecrypt();
		const first = ingestRemoteMute(accountA, event('R', 2), old.decrypt);
		initialize(accountB);
		const current = deferredDecrypt();
		const second = ingestRemoteMute(accountB, event('B', 3, accountB), current.decrypt);
		const failure = new Error('old account decrypt failed');
		old.deferred.reject(failure);
		await expect(first).rejects.toBe(failure);
		current.deferred.resolve([[], false]);
		await second;
		expect(getCanonicalMuteEvent()?.id).toBe('B');

		const pending = deferredDecrypt();
		const afterReset = ingestRemoteMute(accountB, event('B2', 4, accountB), pending.decrypt);
		resetRegularMute();
		pending.deferred.reject(failure);
		await expect(afterReset).rejects.toBe(failure);
		expect(getCanonicalMuteEvent()).toBeUndefined();
		expect(getEffectiveMuteTags().pubkeys).toEqual([]);
	});

	it('does not replace live canonical with an older same-account initialization snapshot', async () => {
		const baseline = regularMuteRevision();
		await ingestRemoteMute(accountA, event('R', 3), async () => [[], false]);
		applyRegularMuteInitialization(
			accountA,
			prepareRegularMuteState(event('S', 2), accountA),
			baseline
		);
		expect(getCanonicalMuteEvent()?.id).toBe('R');
	});

	it('keeps a newer remote candidate when an older initialization snapshot is applied', async () => {
		const remote = deferredDecrypt();
		const completion = ingestRemoteMute(accountA, event('R', 3), remote.decrypt);
		applyRegularMuteInitialization(
			accountA,
			prepareRegularMuteState(event('S', 2), accountA),
			regularMuteRevision()
		);
		expect(getCanonicalMuteEvent()?.id).toBe('S');
		remote.deferred.resolve([[], false]);
		await completion;
		expect(getCanonicalMuteEvent()?.id).toBe('R');
	});
});
