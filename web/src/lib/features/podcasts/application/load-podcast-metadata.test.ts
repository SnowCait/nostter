import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as Nostr from 'nostr-typedef';

const mocks = vi.hoisted(() => ({
	fetchLastEvent: vi.fn(),
	getSeenOnRelays: vi.fn()
}));

vi.mock('$lib/RxNostrHelper', () => ({ fetchLastEvent: mocks.fetchLastEvent }));
vi.mock('$lib/nostr/relay/relay-hints', () => ({ getSeenOnRelays: mocks.getSeenOnRelays }));

import { loadPodcastMetadata } from './load-podcast-metadata';

const episode = { id: 'episode-id', pubkey: 'podcast-pubkey' };

function metadataEvent(tags: string[][]): Nostr.Event {
	return {
		id: 'metadata-id',
		pubkey: episode.pubkey,
		kind: 10154,
		content: '',
		tags,
		created_at: 1,
		sig: 'sig'
	};
}

beforeEach(() => {
	vi.resetAllMocks();
});

describe('loadPodcastMetadata', () => {
	it('loads and parses the latest metadata using default and episode relays', async () => {
		const relays = ['wss://episode.example.com'];
		mocks.getSeenOnRelays.mockReturnValue(relays);
		mocks.fetchLastEvent.mockResolvedValue(
			metadataEvent([
				['title', 'Podcast title'],
				['website', 'https://example.com']
			])
		);

		const metadata = await loadPodcastMetadata(episode);

		expect(mocks.getSeenOnRelays).toHaveBeenCalledWith(episode.id);
		expect(mocks.fetchLastEvent).toHaveBeenCalledWith(
			{ kinds: [10154], authors: [episode.pubkey], limit: 1 },
			{ defaultReadRelays: true, relays }
		);
		expect(metadata?.title).toBe('Podcast title');
		expect(metadata?.websites.map((website) => website.href)).toEqual(['https://example.com/']);
	});

	it('returns undefined when metadata is not found', async () => {
		mocks.fetchLastEvent.mockResolvedValue(undefined);

		await expect(loadPodcastMetadata(episode)).resolves.toBeUndefined();
	});
});
