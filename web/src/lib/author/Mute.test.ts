import { beforeEach, expect, it, vi } from 'vitest';
import { of } from 'rxjs';
import type { Event, EventTemplate } from 'nostr-tools';
import { mute as muteState } from '$lib/features/mute/application/mute-state.svelte';
import { prepareRegularMuteState } from '$lib/features/mute/domain/mute-state';

const accountA = 'a'.repeat(64);
const accountB = 'b'.repeat(64);
const { auth, fetchLastEvent, send, cachedEvent } = vi.hoisted(() => ({
	auth: { pubkey: 'a'.repeat(64) },
	fetchLastEvent: vi.fn(),
	send: vi.fn(),
	cachedEvent: { current: undefined as Event | undefined }
}));

vi.mock('$lib/auth.svelte', () => ({ auth }));
vi.mock('$lib/RxNostrHelper', () => ({ fetchLastEvent }));
vi.mock('$lib/timelines/MainTimeline', () => ({ rxNostr: { send } }));
vi.mock('$lib/WebStorage', () => ({
	WebStorage: class {
		getReplaceableEvent() {
			return cachedEvent.current;
		}
		setReplaceableEvent() {}
	}
}));
vi.mock('$lib/List', () => ({
	createListContentDecrypter: () => undefined,
	createListContentEncrypter: () => async (_pubkey: string, tags: string[][]) =>
		JSON.stringify(tags)
}));

import { mute, type MuteCapabilities } from './Mute';

function capabilities(pubkey: string): MuteCapabilities {
	return {
		signEvent: vi.fn(async (template: EventTemplate): Promise<Event> => ({
			...template,
			id: pubkey,
			pubkey,
			sig: 'sig'
		})),
		nip04: undefined,
		nip44: undefined
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	cachedEvent.current = undefined;
	send.mockImplementation(() => of({ ok: true }));
	auth.pubkey = accountA;
	muteState.reset();
	muteState.applySnapshot(
		accountA,
		{ regular: prepareRegularMuteState(undefined, accountA), byKind: new Map() },
		muteState.captureInitializationBaseline()
	);
	vi.stubGlobal('localStorage', {});
});

it('keeps queued optimistic regular mutes with the account that requested them', async () => {
	const firstValidation = Promise.withResolvers<undefined>();
	fetchLastEvent.mockImplementation(({ authors }: { authors: string[] }) =>
		authors[0] === accountA ? firstValidation.promise : Promise.resolve(undefined)
	);
	const signerA = capabilities(accountA);
	const signerB = capabilities(accountB);
	const first = mute(signerA, 'p', 'target-a');
	auth.pubkey = accountB;
	cachedEvent.current = {
		id: 'old-account',
		kind: 10000,
		pubkey: accountA,
		created_at: 1,
		tags: [['p', 'old-account-target']],
		content: '',
		sig: 'sig'
	};
	muteState.applySnapshot(
		accountB,
		{ regular: prepareRegularMuteState(undefined, accountB), byKind: new Map() },
		muteState.captureInitializationBaseline()
	);
	const second = mute(signerB, 'p', 'target-b');
	await second;
	firstValidation.resolve(undefined);
	await first;

	expect(signerA.signEvent).toHaveBeenCalledWith(
		expect.objectContaining({ kind: 10000, content: '[["p","target-a"]]' })
	);
	expect(signerB.signEvent).toHaveBeenCalledWith(
		expect.objectContaining({ kind: 10000, content: '[["p","target-b"]]' })
	);
	expect(muteState.state.accountPubkey).toBe(accountB);
	expect(muteState.state.regular.tags.pubkeys).toEqual(['target-b']);
});
