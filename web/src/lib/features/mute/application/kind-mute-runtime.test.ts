import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Event } from 'nostr-tools';
import { prepareKindMuteState } from '../domain/mute-state';
import {
	applyKindMuteInitialization,
	completeLocalKindMute,
	getKindMuteState,
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
		expect(getKindMuteState(6)?.pubkeys).toEqual(new Set(['six-new-public', 'six-private']));
		expect(getKindMuteState(7)?.pubkeys).toEqual(new Set(['seven-public']));
		expect(isKindMutedPubkey(7, 'seven-public')).toBe(true);
		expect(isKindMutedPubkey(6, 'seven-public')).toBe(false);
	});

	it('returns defensive copies of canonical state', () => {
		initialize(ownerA, [event('six', 1)]);
		const state = getKindMuteState(6);
		(state?.pubkeys as Set<string> | undefined)?.add('mutated');
		if (state !== undefined) {
			state.event.tags[0]![1] = '7';
		}
		expect(getKindMuteState(6)?.pubkeys).toEqual(new Set(['six-public']));
		expect(getKindMuteState(6)?.event.tags[0]?.[1]).toBe('6');
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
		await expect(pendingSix).resolves.toBeUndefined();
		seven.result.resolve([[], false]);
		await pendingSeven;
		expect(getKindMuteState(6)?.pubkeys).toEqual(new Set(['six-public']));
		expect(getKindMuteState(7)?.event.id).toBe('seven');
	});

	it('applies the failed event public tags without rejecting or retrying the same event', async () => {
		initialize(ownerA, [event('original', 1)]);
		const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const failed = deferredDecrypt();
		const remote = event('remote', 2);
		const pending = ingestRemoteKindMute(ownerA, remote, failed.decrypt);
		failed.result.reject(new Error('decrypt failed'));
		await expect(pending).resolves.toBeUndefined();
		expect(consoleWarn).toHaveBeenCalledOnce();
		expect(getKindMuteState(6)?.event.id).toBe('remote');
		expect(getKindMuteState(6)?.pubkeys).toEqual(new Set(['remote-public']));
		const duplicate = vi.fn(async () => [[['p', 'private']], false] as [string[][], boolean]);
		await ingestRemoteKindMute(ownerA, remote, duplicate);
		expect(duplicate).not.toHaveBeenCalled();
		expect(getKindMuteState(6)?.pubkeys).toEqual(new Set(['remote-public']));
		consoleWarn.mockRestore();
	});

	it('ignores a stale decrypt failure while a preferred candidate completes', async () => {
		const first = deferredDecrypt();
		const second = deferredDecrypt();
		const older = ingestRemoteKindMute(ownerA, event('older', 1), first.decrypt);
		const newer = ingestRemoteKindMute(ownerA, event('newer', 2), second.decrypt);
		first.result.reject(new Error('failed'));
		await expect(older).resolves.toBeUndefined();
		expect(getKindMuteState(6)).toBeUndefined();
		const duplicate = vi.fn(async () => [[], false] as [string[][], boolean]);
		await ingestRemoteKindMute(ownerA, event('newer', 2), duplicate);
		expect(duplicate).not.toHaveBeenCalled();
		second.result.resolve([[['p', 'newer-private']], false]);
		await newer;
		expect(getKindMuteState(6)?.event.id).toBe('newer');
		expect(getKindMuteState(6)?.pubkeys).toEqual(new Set(['newer-public', 'newer-private']));
	});

	it('does not roll back a newer canonical event after decrypt failure', async () => {
		const failed = deferredDecrypt();
		const pending = ingestRemoteKindMute(ownerA, event('remote', 2), failed.decrypt);
		completeLocalKindMute(ownerA, 6, event('local', 3), [['p', 'local-private']]);
		failed.result.reject(new Error('decrypt failed'));
		await expect(pending).resolves.toBeUndefined();
		expect(getKindMuteState(6)?.event.id).toBe('local');
		expect(getKindMuteState(6)?.pubkeys).toEqual(new Set(['local-public', 'local-private']));
	});

	it('preserves fully materialized private tags from the same event after decrypt failure', async () => {
		const signed = event('signed', 2);
		const failed = deferredDecrypt();
		const pending = ingestRemoteKindMute(ownerA, signed, failed.decrypt);
		completeLocalKindMute(ownerA, 6, signed, [['p', 'private']]);
		failed.result.reject(new Error('decrypt failed'));
		await expect(pending).resolves.toBeUndefined();
		expect(getKindMuteState(6)?.event.id).toBe('signed');
		expect(getKindMuteState(6)?.pubkeys).toEqual(new Set(['signed-public', 'private']));
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
		expect(getKindMuteState(6)).toBeUndefined();
	});

	it('replaces old account state and candidates when the owner changes', async () => {
		initialize(ownerA, [event('old', 1)]);
		const decrypt = deferredDecrypt();
		const pending = ingestRemoteKindMute(ownerA, event('pending', 2, 7), decrypt.decrypt);
		initialize(ownerB, [event('new', 1, 16, ownerB)]);
		decrypt.result.resolve([[], false]);
		await pending;
		expect(getKindMuteState(16)?.pubkeys).toEqual(new Set(['new-public']));
		initialize(ownerA);
		expect(getKindMuteState(16)).toBeUndefined();
	});

	it('ignores stale async completion and failure after reset', async () => {
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
		await expect(pendingFailure).resolves.toBeUndefined();
		expect(getKindMuteState(6)?.pubkeys).toEqual(new Set(['current-public']));
		expect(getKindMuteState(7)).toBeUndefined();
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
