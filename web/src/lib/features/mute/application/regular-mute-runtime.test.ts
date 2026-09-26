import { beforeEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import type { Event } from 'nostr-tools';
import { prepareMuteTags, prepareRegularMuteState } from '../domain/mute-state';
import { isMuteEvent } from '$lib/stores/Author';
import {
	applyRegularMuteInitialization,
	canonicalMuteState,
	clearOptimisticMute,
	completeLocalMute,
	ingestRemoteMute,
	muteEvent,
	muteEventIds,
	mutePubkeys,
	muteWords,
	regularMuteRevision,
	resetRegularMute,
	startOptimisticMute
} from './regular-mute-runtime';

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
		expect(get(canonicalMuteState).tags).toEqual({
			pubkeys: ['public-P'],
			eventIds: ['private-P'],
			words: []
		});
		expect(get(muteEvent)?.id).toBe('P');
		expect(get(mutePubkeys)).toEqual(['O']);
		expect(get(muteEventIds)).toEqual([]);
		expect(get(muteWords)).toEqual(['O-word']);
		get(mutePubkeys).push('mutated');
		get(muteEvent)?.tags.push(['p', 'mutated']);
		expect(get(canonicalMuteState).event?.tags).toEqual([['p', 'public-P']]);
		clearOptimisticMute(accountA, token);
		expect(get(mutePubkeys)).toEqual(['public-P']);
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
			expect(get(canonicalMuteState).event?.id).toBe('R');
			expect(get(canonicalMuteState).tags.eventIds).toEqual(['R-private']);
			expect(get(mutePubkeys)).toEqual(['O']);
			clearOptimisticMute(accountA, currentToken);
			expect(get(mutePubkeys)).toEqual(['R']);
		}
	);

	it('uses only the preferred overlapping remote candidate', async () => {
		const r1 = deferredDecrypt();
		const r2 = deferredDecrypt();
		const p1 = ingestRemoteMute(accountA, event('R1', 2), r1.decrypt);
		const p2 = ingestRemoteMute(accountA, event('R2', 3), r2.decrypt);
		r1.deferred.resolve([[['word', 'old']], false]);
		await p1;
		expect(get(muteEvent)?.id).toBe('P');
		r2.deferred.resolve([[['word', 'new']], false]);
		await p2;
		expect(get(muteEvent)?.id).toBe('R2');
		expect(get(muteWords)).toEqual(['new']);
	});

	it('clears only its own optimistic operation after a remote update', async () => {
		const o1 = startOptimisticMute(accountA, prepareMuteTags([['p', 'O1']], accountA));
		const remote = deferredDecrypt();
		const completion = ingestRemoteMute(accountA, event('R', 2), remote.decrypt);
		const o2 = startOptimisticMute(accountA, prepareMuteTags([['p', 'O2']], accountA));
		remote.deferred.resolve([[], false]);
		await completion;
		clearOptimisticMute(accountA, o1);
		expect(get(mutePubkeys)).toEqual(['O2']);
		clearOptimisticMute(accountA, o2);
		expect(get(mutePubkeys)).toEqual(['R']);
	});

	it('completes a cache accepted local event without self decrypt', () => {
		const token = startOptimisticMute(accountA, prepareMuteTags([['p', 'O']], accountA));
		completeLocalMute(
			accountA,
			event('L', 2, accountA, [['p', 'public-L']]),
			[['p', 'private-L']],
			token
		);
		expect(get(muteEvent)?.id).toBe('L');
		expect(get(mutePubkeys)).toEqual(['public-L', 'private-L']);
	});

	it('does not revive an old decrypt after account switch or reset', async () => {
		const old = deferredDecrypt();
		const completion = ingestRemoteMute(accountA, event('R', 2), old.decrypt);
		startOptimisticMute(accountA, prepareMuteTags([['p', 'O']], accountA));
		initialize(accountB);
		old.deferred.resolve([[], false]);
		await completion;
		expect(get(muteEvent)).toBeUndefined();
		expect(get(mutePubkeys)).toEqual([]);
		const next = deferredDecrypt();
		const nextCompletion = ingestRemoteMute(accountB, event('B', 3, accountB), next.decrypt);
		resetRegularMute();
		next.deferred.resolve([[], false]);
		await nextCompletion;
		expect(get(muteEvent)).toBeUndefined();
	});

	it('does not replace live canonical with an older same-account initialization snapshot', async () => {
		const baseline = regularMuteRevision();
		await ingestRemoteMute(accountA, event('R', 3), async () => [[], false]);
		applyRegularMuteInitialization(
			accountA,
			prepareRegularMuteState(event('S', 2), accountA),
			baseline
		);
		expect(get(muteEvent)?.id).toBe('R');
	});

	it('keeps a newer remote candidate when an older initialization snapshot is applied', async () => {
		const remote = deferredDecrypt();
		const completion = ingestRemoteMute(accountA, event('R', 3), remote.decrypt);
		applyRegularMuteInitialization(
			accountA,
			prepareRegularMuteState(event('S', 2), accountA),
			regularMuteRevision()
		);
		expect(get(muteEvent)?.id).toBe('S');
		remote.deferred.resolve([[], false]);
		await completion;
		expect(get(muteEvent)?.id).toBe('R');
	});
});
