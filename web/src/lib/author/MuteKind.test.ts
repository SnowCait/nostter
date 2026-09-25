import { beforeEach, expect, it, vi } from 'vitest';
import { of } from 'rxjs';
import type { Event, EventTemplate } from 'nostr-tools';
import { mute as muteState } from '$lib/features/mute/application/mute-state.svelte';
import { prepareRegularMuteState } from '$lib/features/mute/domain/mute-state';

const accountPubkey = 'a'.repeat(64);
const { auth, fetchLastEvent, send, decrypt } = vi.hoisted(() => ({
	auth: { pubkey: 'a'.repeat(64) },
	fetchLastEvent: vi.fn(),
	send: vi.fn(),
	decrypt: vi.fn()
}));

vi.mock('$lib/auth.svelte', () => ({ auth }));
vi.mock('$lib/RxNostrHelper', () => ({ fetchLastEvent }));
vi.mock('$lib/timelines/MainTimeline', () => ({ rxNostr: { send } }));
vi.mock('$lib/WebStorage', () => ({
	WebStorage: class {
		getParameterizedReplaceableEvent() {
			return undefined;
		}
		setParameterizedReplaceableEvent() {}
	}
}));
vi.mock('$lib/List', () => ({
	createListContentDecrypter: () => decrypt,
	createListContentEncrypter: () => async (_pubkey: string, tags: string[][]) =>
		JSON.stringify(tags)
}));

import { muteByKind, type MuteKindCapabilities } from './MuteKind';

beforeEach(() => {
	vi.clearAllMocks();
	send.mockImplementation(() => of({ ok: true }));
	decrypt.mockRejectedValue(new Error('self-decrypt must not run'));
	muteState.reset();
	muteState.applySnapshot(
		accountPubkey,
		{ regular: prepareRegularMuteState(undefined, accountPubkey), byKind: new Map() },
		muteState.captureInitializationBaseline()
	);
	vi.stubGlobal('localStorage', {});
});

it('publishes independent kinds and prepares the signed event from available private tags', async () => {
	const firstValidation = Promise.withResolvers<undefined>();
	fetchLastEvent.mockImplementation(({ '#d': identifiers }: { '#d': string[] }) =>
		identifiers[0] === '6' ? firstValidation.promise : Promise.resolve(undefined)
	);
	const capabilities: MuteKindCapabilities = {
		signEvent: vi.fn(async (template: EventTemplate): Promise<Event> => ({
			...template,
			id: template.tags[0]?.[1] ?? '',
			pubkey: accountPubkey,
			sig: 'sig'
		})),
		nip04: undefined,
		nip44: undefined
	};
	const first = muteByKind(capabilities, 6, 'target-six');
	const second = muteByKind(capabilities, 7, 'target-seven');
	await second;
	expect(muteState.state.byKind.get(7)?.pubkeys).toEqual(new Set(['target-seven']));
	expect(muteState.state.byKind.has(6)).toBe(false);
	firstValidation.resolve(undefined);
	await first;
	expect(muteState.state.byKind.get(6)?.pubkeys).toEqual(new Set(['target-six']));
	expect(decrypt).not.toHaveBeenCalled();
});
