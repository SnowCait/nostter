import { beforeEach, expect, it, vi } from 'vitest';
import { of } from 'rxjs';
import type { Event, EventTemplate } from 'nostr-tools';
import { mute as muteState } from '$lib/features/mute/application/mute-state.svelte';
import { prepareRegularMuteState } from '$lib/features/mute/domain/mute-state';
import { WebStorage } from '$lib/WebStorage';

const accountPubkey = 'a'.repeat(64);
const accountB = 'b'.repeat(64);
const { auth, fetchLastEvent, send, decrypt } = vi.hoisted(() => ({
	auth: { pubkey: 'a'.repeat(64) },
	fetchLastEvent: vi.fn(),
	send: vi.fn(),
	decrypt: vi.fn()
}));

vi.mock('$lib/auth.svelte', () => ({ auth }));
vi.mock('$lib/RxNostrHelper', () => ({ fetchLastEvent }));
vi.mock('$lib/timelines/MainTimeline', () => ({ rxNostr: { send } }));
vi.mock('$lib/cache/Events', () => ({ eventCache: { addIfNotExists: vi.fn() } }));
vi.mock('$lib/List', () => ({
	createListContentDecrypter: () => decrypt,
	createListContentEncrypter: () => async (_pubkey: string, tags: string[][]) =>
		JSON.stringify(tags)
}));

import { muteByKind, type MuteKindCapabilities } from './MuteKind';

function memoryStorage(): Storage {
	const items = new Map<string, string>();
	return {
		get length() {
			return items.size;
		},
		clear() {
			items.clear();
		},
		getItem(key) {
			return items.get(key) ?? null;
		},
		key(index) {
			return [...items.keys()][index] ?? null;
		},
		removeItem(key) {
			items.delete(key);
		},
		setItem(key, value) {
			items.set(key, value);
		}
	};
}

function capabilities(pubkey: string): MuteKindCapabilities {
	return {
		signEvent: vi.fn(async (template: EventTemplate): Promise<Event> => ({
			...template,
			id: template.tags[0]?.[1] ?? '',
			pubkey,
			sig: 'sig'
		})),
		nip04: undefined,
		nip44: undefined
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	auth.pubkey = accountPubkey;
	send.mockImplementation(() => of({ ok: true }));
	decrypt.mockRejectedValue(new Error('self-decrypt must not run'));
	muteState.reset();
	muteState.applySnapshot(
		accountPubkey,
		{ regular: prepareRegularMuteState(undefined, accountPubkey), byKind: new Map() },
		muteState.captureInitializationBaseline()
	);
	vi.stubGlobal('localStorage', memoryStorage());
});

it('publishes independent kinds and prepares the signed event from available private tags', async () => {
	const firstValidation = Promise.withResolvers<undefined>();
	fetchLastEvent.mockImplementation(({ '#d': identifiers }: { '#d': string[] }) =>
		identifiers[0] === '6' ? firstValidation.promise : Promise.resolve(undefined)
	);
	const signer = capabilities(accountPubkey);
	const first = muteByKind(signer, 6, 'target-six');
	const second = muteByKind(signer, 7, 'target-seven');
	await second;
	expect(muteState.state.byKind.get(7)?.pubkeys).toEqual(new Set(['target-seven']));
	expect(muteState.state.byKind.has(6)).toBe(false);
	firstValidation.resolve(undefined);
	await first;
	expect(muteState.state.byKind.get(6)?.pubkeys).toEqual(new Set(['target-six']));
	expect(decrypt).not.toHaveBeenCalled();
});

it('keeps the active account kind mute cache after an old publication completes', async () => {
	const firstValidation = Promise.withResolvers<undefined>();
	fetchLastEvent.mockImplementation(({ authors }: { authors: string[] }) =>
		authors[0] === accountPubkey ? firstValidation.promise : Promise.resolve(undefined)
	);
	const first = muteByKind(capabilities(accountPubkey), 6, 'target-a');
	auth.pubkey = accountB;
	muteState.applySnapshot(
		accountB,
		{ regular: prepareRegularMuteState(undefined, accountB), byKind: new Map() },
		muteState.captureInitializationBaseline()
	);
	await muteByKind(capabilities(accountB), 6, 'target-b');
	const storage = new WebStorage(localStorage);
	expect(storage.getParameterizedReplaceableEvent(30007, '6')?.pubkey).toBe(accountB);
	expect(storage.getCachedAccountPubkey()).toBe(accountB);
	firstValidation.resolve(undefined);
	await first;
	expect(storage.getParameterizedReplaceableEvent(30007, '6')?.pubkey).toBe(accountB);
	expect(storage.getCachedAccountPubkey()).toBe(accountB);
	expect(muteState.state.accountPubkey).toBe(accountB);
	expect(muteState.state.byKind.get(6)?.event.pubkey).toBe(accountB);
});
