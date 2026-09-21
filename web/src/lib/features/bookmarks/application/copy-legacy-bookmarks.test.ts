import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY, from, of, Subject } from 'rxjs';
import type * as Nostr from 'nostr-typedef';
import { kinds as Kind } from 'nostr-tools';
import { get } from 'svelte/store';
import { legacyBookmarkIdentifier } from '$lib/Constants';

const mocks = vi.hoisted(() => ({
	userPubkey: 'f'.repeat(64),
	fetchLastEvent: vi.fn(),
	use: vi.fn(),
	normalSignEvent: vi.fn(),
	copySignEvent: vi.fn(),
	copyDecrypt: vi.fn(),
	copyDecryptNip44: vi.fn(),
	copyEncryptNip44: vi.fn(),
	send: vi.fn(),
	getReplaceableEvent: vi.fn(),
	setReplaceableEvent: vi.fn(),
	storage: { cachedEvent: undefined as unknown }
}));

vi.mock('$lib/stores/Author', async () => {
	const { writable } = await import('svelte/store');
	return { pubkey: writable(mocks.userPubkey) };
});
vi.mock('$lib/RxNostrHelper', () => ({ fetchLastEvent: mocks.fetchLastEvent }));
vi.mock('$lib/Signer', () => ({
	Signer: {
		signEvent: mocks.normalSignEvent
	}
}));
vi.mock('$lib/nostr/relay/client', () => ({
	rxNostr: { send: mocks.send, use: mocks.use }
}));
vi.mock('$lib/nostr/relay/relay-hints', () => ({
	tie: <T>(source: T): T => source
}));
vi.mock('$lib/timelines/MainTimeline', () => ({
	rxNostr: { send: mocks.send }
}));
vi.mock('$lib/WebStorage', () => ({
	WebStorage: class {
		getReplaceableEvent() {
			return mocks.getReplaceableEvent();
		}

		setReplaceableEvent(event: Nostr.Event) {
			mocks.setReplaceableEvent(event);
		}
	}
}));
vi.stubGlobal('localStorage', {});

import {
	bookmark,
	bookmarkEvent,
	bookmarkOperationState,
	legacyBookmarkEvent
} from '../../../author/Bookmark.svelte';
import {
	copyLegacyBookmarks as copyLegacyBookmarksWithSigner,
	type BookmarkMigrationSigner
} from './copy-legacy-bookmarks';

const eventId = 'a'.repeat(64);
const otherEventId = 'b'.repeat(64);
const address = `30023:${'c'.repeat(64)}:article`;
const otherAddress = `30023:${'d'.repeat(64)}:other-article`;

function event(
	kind: number,
	tags: string[][] = [],
	content = '',
	id = `${kind}-event`,
	created_at = 1
): Nostr.Event {
	return {
		kind,
		tags,
		content,
		id,
		created_at,
		pubkey: mocks.userPubkey,
		sig: 'sig'
	};
}

function signedEvent(unsigned: Nostr.UnsignedEvent, id = 'signed'): Nostr.Event {
	return { ...unsigned, id, pubkey: mocks.userPubkey, sig: 'sig' };
}

let legacyRelayEvent: Nostr.Event | undefined;
let standardRelayEvent: Nostr.Event | undefined;

const migrationSigner: BookmarkMigrationSigner = {
	signEvent: mocks.copySignEvent,
	nip04: { decrypt: mocks.copyDecrypt },
	nip44: { decrypt: mocks.copyDecryptNip44, encrypt: mocks.copyEncryptNip44 }
};

const copyLegacyBookmarks = () => copyLegacyBookmarksWithSigner(migrationSigner);

beforeEach(() => {
	vi.resetAllMocks();
	legacyRelayEvent = event(Kind.Genericlists, [
		['d', legacyBookmarkIdentifier],
		['e', eventId]
	]);
	standardRelayEvent = undefined;
	mocks.storage.cachedEvent = undefined;
	mocks.fetchLastEvent.mockImplementation(async (filter: { kinds?: number[] }) => {
		if (filter.kinds?.[0] === Kind.BookmarkList) {
			return standardRelayEvent;
		}
		return undefined;
	});
	mocks.use.mockImplementation(() => {
		const events = [legacyRelayEvent, standardRelayEvent].filter(
			(sourceEvent): sourceEvent is Nostr.Event => sourceEvent !== undefined
		);
		return from(events.map((sourceEvent) => ({ event: sourceEvent, from: 'relay.example' })));
	});
	mocks.normalSignEvent.mockImplementation(async (unsigned: Nostr.UnsignedEvent) =>
		signedEvent(unsigned)
	);
	mocks.copySignEvent.mockImplementation(async (unsigned: Nostr.UnsignedEvent) =>
		signedEvent(unsigned)
	);
	mocks.copyEncryptNip44.mockImplementation(
		async (_pubkey: string, plaintext: string) => `nip44:${plaintext}`
	);
	mocks.send.mockImplementation((sentEvent: Nostr.Event) => {
		standardRelayEvent = sentEvent;
		return of({ ok: true });
	});
	mocks.getReplaceableEvent.mockImplementation(() => mocks.storage.cachedEvent);
	mocks.setReplaceableEvent.mockImplementation((storedEvent: Nostr.Event) => {
		mocks.storage.cachedEvent = storedEvent;
	});
	bookmarkEvent.set(undefined);
	legacyBookmarkEvent.set(undefined);
});

describe('copy exclusivity', () => {
	it('rejects copy while a normal bookmark write is processing', async () => {
		const pendingSign = Promise.withResolvers<Nostr.Event>();
		let unsignedEvent: Nostr.UnsignedEvent | undefined;
		mocks.normalSignEvent.mockImplementationOnce((unsigned: Nostr.UnsignedEvent) => {
			unsignedEvent = unsigned;
			return pendingSign.promise;
		});

		const normalWrite = bookmark(['e', eventId]);
		await vi.waitFor(() => expect(mocks.normalSignEvent).toHaveBeenCalledOnce());
		expect(bookmarkOperationState.copyInProgress).toBe(false);
		expect(bookmarkOperationState.canStartCopy).toBe(false);
		await expect(bookmark(['e', otherEventId])).resolves.toBeUndefined();

		await expect(copyLegacyBookmarks()).rejects.toThrow('busy');
		expect(mocks.use).not.toHaveBeenCalled();

		pendingSign.resolve(signedEvent(unsignedEvent!, 'normal-write'));
		await normalWrite;
		expect(mocks.normalSignEvent).toHaveBeenCalledTimes(2);
		expect(bookmarkOperationState.canStartCopy).toBe(true);
	});

	it('releases normal processing state after a publish failure', async () => {
		mocks.normalSignEvent.mockRejectedValueOnce(new Error('sign failed'));

		await expect(bookmark(['e', eventId])).rejects.toThrow('sign failed');
		expect(bookmarkOperationState.copyInProgress).toBe(false);
		expect(bookmarkOperationState.canStartCopy).toBe(true);

		await bookmark(['e', otherEventId]);
		expect(mocks.normalSignEvent).toHaveBeenCalledTimes(2);
	});

	it('does not enqueue bookmarks during copy and releases the lock after failure', async () => {
		const pendingSources = new Subject<{ event: Nostr.Event; from: string }>();
		mocks.use.mockReturnValueOnce(pendingSources);

		const copy = copyLegacyBookmarks();
		await vi.waitFor(() => expect(mocks.use).toHaveBeenCalledOnce());
		expect(bookmarkOperationState.copyInProgress).toBe(true);
		expect(bookmarkOperationState.canStartCopy).toBe(false);
		await expect(bookmark(['e', eventId])).rejects.toThrow('copy is in progress');
		expect(mocks.normalSignEvent).not.toHaveBeenCalled();
		expect(mocks.copySignEvent).not.toHaveBeenCalled();

		pendingSources.error(new Error('relay failure'));
		await expect(copy).rejects.toThrow('not found');
		expect(bookmarkOperationState.copyInProgress).toBe(false);
		expect(bookmarkOperationState.canStartCopy).toBe(true);
		await bookmark(['e', otherEventId]);

		expect(mocks.normalSignEvent).toHaveBeenCalledOnce();
		expect(mocks.normalSignEvent).toHaveBeenCalledWith(
			expect.objectContaining({ tags: [['e', otherEventId]] })
		);
	});

	it('rejects a second copy while copy is running', async () => {
		const pendingSources = new Subject<{ event: Nostr.Event; from: string }>();
		mocks.use.mockReturnValueOnce(pendingSources);

		const firstCopy = copyLegacyBookmarks();
		await vi.waitFor(() => expect(mocks.use).toHaveBeenCalledOnce());
		await expect(copyLegacyBookmarks()).rejects.toThrow('busy');

		pendingSources.error(new Error('stop copy'));
		await expect(firstCopy).rejects.toThrow('not found');
	});

	it('releases the lock after success so a normal bookmark write can start', async () => {
		const copiedEvent = await copyLegacyBookmarks();
		expect(bookmarkOperationState.copyInProgress).toBe(false);
		expect(bookmarkOperationState.canStartCopy).toBe(true);

		await bookmark(['e', otherEventId]);

		expect(copiedEvent?.kind).toBe(Kind.BookmarkList);
		expect(mocks.copySignEvent).toHaveBeenCalledOnce();
		expect(mocks.normalSignEvent).toHaveBeenCalledOnce();
	});
});

describe('copy sources and public references', () => {
	it('copies public bookmarks with only event signing capability', async () => {
		const signer: BookmarkMigrationSigner = { signEvent: mocks.copySignEvent };

		await copyLegacyBookmarksWithSigner(signer);

		expect(mocks.copySignEvent).toHaveBeenCalledWith(
			expect.objectContaining({ tags: [['e', eventId]], content: '' })
		);
	});

	it('fetches and uses the latest legacy bookmark event from relays', async () => {
		const staleEvent = event(
			Kind.Genericlists,
			[
				['d', legacyBookmarkIdentifier],
				['e', otherEventId]
			],
			'',
			'stale',
			1
		);
		legacyBookmarkEvent.set(staleEvent);
		legacyRelayEvent = event(
			Kind.Genericlists,
			[
				['d', legacyBookmarkIdentifier],
				['e', eventId]
			],
			'',
			'fresh',
			2
		);
		mocks.use.mockReturnValueOnce(
			from(
				[staleEvent, legacyRelayEvent].map((sourceEvent) => ({
					event: sourceEvent,
					from: 'relay.example'
				}))
			)
		);

		await copyLegacyBookmarks();

		expect(mocks.use).toHaveBeenCalledOnce();
		expect(mocks.copySignEvent).toHaveBeenCalledWith(
			expect.objectContaining({ tags: [['e', eventId]] })
		);
	});

	it('does not publish when no legacy bookmark event is found', async () => {
		legacyRelayEvent = undefined;

		await expect(copyLegacyBookmarks()).rejects.toThrow('not found');

		expect(mocks.copySignEvent).not.toHaveBeenCalled();
		expect(mocks.send).not.toHaveBeenCalled();
	});

	it('does not publish an invalid legacy bookmark event', async () => {
		legacyRelayEvent = event(Kind.Genericlists, [['d', 'other']]);

		await expect(copyLegacyBookmarks()).rejects.toThrow('Invalid legacy');

		expect(mocks.copySignEvent).not.toHaveBeenCalled();
		expect(mocks.send).not.toHaveBeenCalled();
	});

	it('rejects an unverifiable cached standard bookmark event', async () => {
		mocks.storage.cachedEvent = event(Kind.BookmarkList, [['e', otherEventId]]);

		await expect(copyLegacyBookmarks()).rejects.toThrow('freshness');

		expect(mocks.copySignEvent).not.toHaveBeenCalled();
		expect(mocks.send).not.toHaveBeenCalled();
	});

	it('uses the relay standard event as the base instead of the cache', async () => {
		const staleStandardEvent = event(Kind.BookmarkList, [['e', 'stale']], '', 'stale', 1);
		mocks.storage.cachedEvent = event(Kind.BookmarkList, [['e', 'cached']]);
		standardRelayEvent = event(Kind.BookmarkList, [['e', otherEventId]], '', 'fresh', 2);
		mocks.use.mockReturnValueOnce(
			from(
				[legacyRelayEvent!, staleStandardEvent, standardRelayEvent].map((sourceEvent) => ({
					event: sourceEvent,
					from: 'relay.example'
				}))
			)
		);

		await copyLegacyBookmarks();

		expect(mocks.use).toHaveBeenCalledOnce();
		expect(mocks.copySignEvent).toHaveBeenCalledWith(
			expect.objectContaining({
				tags: [
					['e', otherEventId],
					['e', eventId]
				]
			})
		);
	});

	it('preserves standard public references and adds only new valid legacy references', async () => {
		standardRelayEvent = event(Kind.BookmarkList, [
			['e', eventId, 'wss://relay.example'],
			['a', address, 'wss://articles.example']
		]);
		legacyRelayEvent = event(Kind.Genericlists, [
			['d', legacyBookmarkIdentifier],
			['title', 'Bookmarks'],
			['p', mocks.userPubkey],
			['e', eventId],
			['a', address],
			['e', otherEventId],
			['a', otherAddress]
		]);

		await copyLegacyBookmarks();

		expect(mocks.copySignEvent).toHaveBeenCalledWith(
			expect.objectContaining({
				tags: [
					['e', eventId, 'wss://relay.example'],
					['a', address, 'wss://articles.example'],
					['e', otherEventId],
					['a', otherAddress]
				]
			})
		);
	});

	it('does not publish a replacement event when copy adds nothing', async () => {
		standardRelayEvent = event(Kind.BookmarkList, [['e', eventId]]);

		await expect(copyLegacyBookmarks()).resolves.toBeUndefined();

		expect(mocks.copyEncryptNip44).not.toHaveBeenCalled();
		expect(mocks.copySignEvent).not.toHaveBeenCalled();
		expect(mocks.send).not.toHaveBeenCalled();
	});
});

describe('private bookmark copy', () => {
	it('rejects private content without its required encryption capability', async () => {
		legacyRelayEvent = event(
			Kind.Genericlists,
			[['d', legacyBookmarkIdentifier]],
			'legacy-nip44'
		);
		const signer: BookmarkMigrationSigner = { signEvent: mocks.copySignEvent };

		await expect(copyLegacyBookmarksWithSigner(signer)).rejects.toThrow(
			'Required bookmark encryption capability is unavailable'
		);

		expect(mocks.copySignEvent).not.toHaveBeenCalled();
		expect(mocks.send).not.toHaveBeenCalled();
	});

	it('strictly decrypts, merges, and re-encrypts private references with NIP-44', async () => {
		standardRelayEvent = event(Kind.BookmarkList, [['e', eventId]], 'standard-nip44');
		legacyRelayEvent = event(
			Kind.Genericlists,
			[
				['d', legacyBookmarkIdentifier],
				['e', otherEventId]
			],
			'legacy?iv=nip04'
		);
		mocks.copyDecryptNip44.mockResolvedValue(
			JSON.stringify([['a', address, 'wss://articles.example']])
		);
		mocks.copyDecrypt.mockResolvedValue(
			JSON.stringify([
				['a', address],
				['e', otherEventId],
				['a', otherAddress]
			])
		);

		await copyLegacyBookmarks();

		expect(mocks.copyDecryptNip44).toHaveBeenCalledWith(mocks.userPubkey, 'standard-nip44');
		expect(mocks.copyDecrypt).toHaveBeenCalledWith(mocks.userPubkey, 'legacy?iv=nip04');
		expect(mocks.copyEncryptNip44).toHaveBeenCalledWith(
			mocks.userPubkey,
			JSON.stringify([
				['a', address, 'wss://articles.example'],
				['e', otherEventId],
				['a', otherAddress]
			])
		);
		expect(mocks.copySignEvent).toHaveBeenCalledWith(
			expect.objectContaining({
				tags: [
					['e', eventId],
					['e', otherEventId]
				],
				content: expect.stringContaining('nip44:')
			})
		);
	});

	it('decrypts a NIP-44 legacy source', async () => {
		legacyRelayEvent = event(
			Kind.Genericlists,
			[['d', legacyBookmarkIdentifier]],
			'legacy-nip44'
		);
		mocks.copyDecryptNip44.mockResolvedValue(JSON.stringify([['a', address]]));

		await copyLegacyBookmarks();

		expect(mocks.copyDecryptNip44).toHaveBeenCalledWith(mocks.userPubkey, 'legacy-nip44');
		expect(mocks.copyDecrypt).not.toHaveBeenCalled();
		expect(mocks.copyEncryptNip44).toHaveBeenCalledOnce();
	});

	it('rejects a legacy private decrypt failure before signing or publishing', async () => {
		legacyRelayEvent = event(
			Kind.Genericlists,
			[['d', legacyBookmarkIdentifier]],
			'legacy-nip44'
		);
		mocks.copyDecryptNip44.mockRejectedValue(new Error('decrypt failed'));

		await expect(copyLegacyBookmarks()).rejects.toThrow('decrypt failed');

		expect(mocks.copySignEvent).not.toHaveBeenCalled();
		expect(mocks.send).not.toHaveBeenCalled();
	});

	it('rejects a standard private decrypt failure before signing or publishing', async () => {
		standardRelayEvent = event(Kind.BookmarkList, [], 'standard-nip44');
		mocks.copyDecryptNip44.mockRejectedValue(new Error('decrypt failed'));

		await expect(copyLegacyBookmarks()).rejects.toThrow('decrypt failed');

		expect(mocks.copySignEvent).not.toHaveBeenCalled();
		expect(mocks.send).not.toHaveBeenCalled();
	});

	it.each(['not JSON', JSON.stringify({ tags: [['e', eventId]] })])(
		'rejects invalid private JSON before signing or publishing',
		async (plaintext) => {
			legacyRelayEvent = event(
				Kind.Genericlists,
				[['d', legacyBookmarkIdentifier]],
				'legacy-nip44'
			);
			mocks.copyDecryptNip44.mockResolvedValue(plaintext);

			await expect(copyLegacyBookmarks()).rejects.toThrow();

			expect(mocks.copySignEvent).not.toHaveBeenCalled();
			expect(mocks.send).not.toHaveBeenCalled();
		}
	);
});

describe('copy publishing', () => {
	it('does not update cache or bookmark state when no relay accepts the event', async () => {
		const previousEvent = event(Kind.BookmarkList, [], '', 'previous');
		bookmarkEvent.set(previousEvent);
		mocks.send.mockReturnValue(EMPTY);

		await expect(copyLegacyBookmarks()).rejects.toThrow();

		expect(mocks.setReplaceableEvent).not.toHaveBeenCalled();
		expect(get(bookmarkEvent)).toBe(previousEvent);
	});

	it('publishes one standard event and updates local state only after relay success', async () => {
		const previousEvent = event(Kind.BookmarkList, [], '', 'previous');
		const relayResults = new Subject<{ ok: boolean }>();
		const updateOrder: string[] = [];
		bookmarkEvent.set(previousEvent);
		mocks.send.mockReturnValue(relayResults);
		mocks.setReplaceableEvent.mockImplementation((storedEvent: Nostr.Event) => {
			updateOrder.push('cache');
			mocks.storage.cachedEvent = storedEvent;
		});
		const unsubscribe = bookmarkEvent.subscribe((storedEvent) => {
			if (storedEvent?.id === 'signed') {
				updateOrder.push('store');
			}
		});

		const copy = copyLegacyBookmarks();
		await vi.waitFor(() => expect(mocks.send).toHaveBeenCalledOnce());
		expect(mocks.setReplaceableEvent).not.toHaveBeenCalled();
		expect(get(bookmarkEvent)).toBe(previousEvent);

		relayResults.next({ ok: true });
		const copiedEvent = await copy;
		unsubscribe();

		expect(mocks.send).toHaveBeenCalledOnce();
		expect(mocks.send).toHaveBeenCalledWith(
			expect.objectContaining({ kind: Kind.BookmarkList })
		);
		expect(mocks.setReplaceableEvent).toHaveBeenCalledWith(copiedEvent);
		expect(get(bookmarkEvent)).toBe(copiedEvent);
		expect(updateOrder).toEqual(['cache', 'store']);
	});
});
