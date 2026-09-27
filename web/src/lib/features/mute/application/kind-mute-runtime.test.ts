import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Event } from 'nostr-tools';
import { prepareKindMuteState } from '../domain/mute-state';
import {
	applyKindMuteInitialization,
	completeLocalKindMute,
	getKindMuteState,
	getMutedPubkeysByKindMap,
	ingestRemoteKindMute,
	isKindMutedPubkey,
	resetKindMute
} from './kind-mute-runtime.svelte';

const ownerA = 'a'.repeat(64);
const ownerB = 'b'.repeat(64);

function event(id: string, created_at: number, muteKind = 6, pubkey = ownerA): Event {
	return {
		id,
		created_at,
		kind: 30007,
		pubkey,
		tags: [
			['d', String(muteKind)],
			['p', `${id}-public`]
		],
		content: 'encrypted',
		sig: 'sig'
	};
}

function initialize(owner: string, events: Event[] = []): void {
	applyKindMuteInitialization(
		owner,
		new Map(events.map((source) => [Number(source.tags[0]?.[1]), prepareKindMuteState(source)]))
	);
}

function deferredDecrypt() {
	const result = Promise.withResolvers<[string[][], boolean]>();
	return { result, decrypt: vi.fn(() => result.promise) };
}

beforeEach(() => {
	resetKindMute();
	initialize(ownerA);
});

describe('kind mute runtime', () => {
	it('keeps canonical state independent per mute kind', async () => {
		await ingestRemoteKindMute(ownerA, event('six', 1), async () => [[], false]);
		await ingestRemoteKindMute(ownerA, event('seven', 1, 7), async () => [[], false]);
		completeLocalKindMute(ownerA, 6, event('six-new', 2), [['p', 'six-private']]);
		expect(getMutedPubkeysByKindMap()).toEqual(
			new Map([
				[6, new Set(['six-new-public', 'six-private'])],
				[7, new Set(['seven-public'])]
			])
		);
		expect(isKindMutedPubkey(7, 'seven-public')).toBe(true);
		expect(isKindMutedPubkey(6, 'seven-public')).toBe(false);
	});

	it('completes only the preferred overlapping candidate for one kind', async () => {
		const first = deferredDecrypt();
		const second = deferredDecrypt();
		const older = ingestRemoteKindMute(ownerA, event('older', 1), first.decrypt);
		const newer = ingestRemoteKindMute(ownerA, event('newer', 2), second.decrypt);
		second.result.resolve([[['p', 'newer-private']], false]);
		await newer;
		first.result.resolve([[['p', 'older-private']], false]);
		await older;
		expect(getKindMuteState(6)?.event.id).toBe('newer');
		expect(getKindMuteState(6)?.pubkeys).toEqual(new Set(['newer-public', 'newer-private']));
	});

	it('holds candidates for different kinds concurrently', async () => {
		const six = deferredDecrypt();
		const seven = deferredDecrypt();
		const pendingSix = ingestRemoteKindMute(ownerA, event('six', 1), six.decrypt);
		const pendingSeven = ingestRemoteKindMute(ownerA, event('seven', 1, 7), seven.decrypt);
		six.result.resolve([[], false]);
		await pendingSix;
		expect(getKindMuteState(7)).toBeUndefined();
		seven.result.resolve([[], false]);
		await pendingSeven;
		expect(getKindMuteState(6)?.event.id).toBe('six');
		expect(getKindMuteState(7)?.event.id).toBe('seven');
	});

	it('a failure for one kind leaves another kind candidate pending', async () => {
		const six = deferredDecrypt();
		const seven = deferredDecrypt();
		const pendingSix = ingestRemoteKindMute(ownerA, event('six', 1), six.decrypt);
		const pendingSeven = ingestRemoteKindMute(ownerA, event('seven', 1, 7), seven.decrypt);
		six.result.reject(new Error('six failed'));
		await expect(pendingSix).rejects.toThrow('six failed');
		seven.result.resolve([[], false]);
		await pendingSeven;
		expect(getKindMuteState(6)).toBeUndefined();
		expect(getKindMuteState(7)?.event.id).toBe('seven');
	});

	it('clears only the failing candidate and permits retry of the same event', async () => {
		const first = deferredDecrypt();
		const second = deferredDecrypt();
		const older = ingestRemoteKindMute(ownerA, event('older', 1), first.decrypt);
		const newer = ingestRemoteKindMute(ownerA, event('newer', 2), second.decrypt);
		first.result.reject(new Error('failed'));
		await expect(older).rejects.toThrow('failed');
		const duplicate = vi.fn(async () => [[], false] as [string[][], boolean]);
		await ingestRemoteKindMute(ownerA, event('newer', 2), duplicate);
		expect(duplicate).not.toHaveBeenCalled();
		second.result.resolve([[], false]);
		await newer;
		expect(getKindMuteState(6)?.event.id).toBe('newer');

		const failed = deferredDecrypt();
		const retryEvent = event('retry', 3, 7);
		const attempt = ingestRemoteKindMute(ownerA, retryEvent, failed.decrypt);
		failed.result.reject(new Error('temporary'));
		await expect(attempt).rejects.toThrow('temporary');
		await ingestRemoteKindMute(ownerA, retryEvent, async () => [[], false]);
		expect(getKindMuteState(7)?.event.id).toBe('retry');
	});

	it('preserves a preferred remote candidate during local completion', async () => {
		const remote = deferredDecrypt();
		const pending = ingestRemoteKindMute(ownerA, event('remote', 3), remote.decrypt);
		completeLocalKindMute(ownerA, 6, event('local', 2), [['p', 'local-private']]);
		expect(getKindMuteState(6)?.event.id).toBe('local');
		remote.result.resolve([[], false]);
		await pending;
		expect(getKindMuteState(6)?.event.id).toBe('remote');
	});

	it('does not accept invalid identifiers or events from another owner', async () => {
		await ingestRemoteKindMute(ownerA, { ...event('bad', 1), tags: [['d', '6x']] });
		await ingestRemoteKindMute(ownerA, event('other', 1, 6, ownerB));
		expect(getMutedPubkeysByKindMap().size).toBe(0);
	});

	it('replaces old account state and candidates when the owner changes', async () => {
		initialize(ownerA, [event('old', 1)]);
		const decrypt = deferredDecrypt();
		const pending = ingestRemoteKindMute(ownerA, event('pending', 2, 7), decrypt.decrypt);
		initialize(ownerB, [event('new', 1, 16, ownerB)]);
		decrypt.result.resolve([[], false]);
		await pending;
		expect(getMutedPubkeysByKindMap()).toEqual(new Map([[16, new Set(['new-public'])]]));
		initialize(ownerA);
		expect(getMutedPubkeysByKindMap().size).toBe(0);
	});

	it('rejects stale async completion and failure after reset', async () => {
		const success = deferredDecrypt();
		const failure = deferredDecrypt();
		const pendingSuccess = ingestRemoteKindMute(ownerA, event('success', 1), success.decrypt);
		const pendingFailure = ingestRemoteKindMute(
			ownerA,
			event('failure', 1, 7),
			failure.decrypt
		);
		resetKindMute();
		initialize(ownerA, [event('current', 2)]);
		success.result.resolve([[], false]);
		failure.result.reject(new Error('old failure'));
		await pendingSuccess;
		await expect(pendingFailure).rejects.toThrow('old failure');
		expect(getMutedPubkeysByKindMap()).toEqual(new Map([[6, new Set(['current-public'])]]));
	});

	it('merges same owner initialization by event preference without dropping live kinds', async () => {
		initialize(ownerA, [event('snapshot', 1), event('seven', 1, 7)]);
		await ingestRemoteKindMute(ownerA, event('live', 3), async () => [[], false]);
		await ingestRemoteKindMute(ownerA, event('live-sixteen', 2, 16), async () => [[], false]);
		initialize(ownerA, [event('stale', 2), event('seven-new', 2, 7)]);
		expect(getKindMuteState(6)?.event.id).toBe('live');
		expect(getKindMuteState(7)?.event.id).toBe('seven-new');
		expect(getKindMuteState(16)?.event.id).toBe('live-sixteen');
	});

	it('does not replace locally materialized private tags with the same event snapshot', () => {
		const signed = event('signed', 1);
		completeLocalKindMute(ownerA, 6, signed, [['p', 'private']]);
		initialize(ownerA, [signed]);
		expect(getKindMuteState(6)?.pubkeys).toEqual(new Set(['signed-public', 'private']));
	});
});
