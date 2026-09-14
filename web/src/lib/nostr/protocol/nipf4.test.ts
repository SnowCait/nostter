import type * as Nostr from 'nostr-typedef';
import { describe, expect, it } from 'vitest';
import { parsePodcastEpisode, parsePodcastMetadata } from './nipf4';

function eventWith(tags: string[][], content = ''): Nostr.Event {
	return { tags, content } as Nostr.Event;
}

describe('parsePodcastEpisode', () => {
	it('parses the episode fields', () => {
		const episode = parsePodcastEpisode(
			eventWith(
				[
					['title', 'Episode title'],
					['image', 'https://example.com/episode.webp'],
					['description', 'Episode description'],
					['audio', 'https://example.com/episode.mp3', 'audio/mpeg']
				],
				'Episode content'
			)
		);

		expect(episode).toEqual({
			title: 'Episode title',
			image: 'https://example.com/episode.webp',
			description: 'Episode description',
			audio: [{ url: 'https://example.com/episode.mp3', mediaType: 'audio/mpeg' }],
			content: 'Episode content'
		});
	});

	it('preserves multiple audio tags', () => {
		const episode = parsePodcastEpisode(
			eventWith([
				['audio', 'https://example.com/episode.mp3', 'audio/mpeg'],
				['audio', 'https://example.com/episode.ogg', 'audio/ogg']
			])
		);

		expect(episode.audio).toEqual([
			{ url: 'https://example.com/episode.mp3', mediaType: 'audio/mpeg' },
			{ url: 'https://example.com/episode.ogg', mediaType: 'audio/ogg' }
		]);
	});

	it('parses audio tags without a media type', () => {
		const episode = parsePodcastEpisode(
			eventWith([['audio', 'https://example.com/episode.mp3']])
		);

		expect(episode.audio).toEqual([
			{ url: 'https://example.com/episode.mp3', mediaType: undefined }
		]);
	});

	it('handles missing optional tags', () => {
		expect(parsePodcastEpisode(eventWith([], 'Episode content'))).toEqual({
			title: undefined,
			image: undefined,
			description: undefined,
			audio: [],
			content: 'Episode content'
		});
	});

	it('ignores unrelated and incomplete tags', () => {
		expect(
			parsePodcastEpisode(
				eventWith([[], ['title'], ['audio'], ['audio', ''], ['unknown', 'value']])
			)
		).toEqual({
			title: undefined,
			image: undefined,
			description: undefined,
			audio: [],
			content: ''
		});
	});
});

describe('parsePodcastMetadata', () => {
	it('parses metadata with multiple websites', () => {
		const metadata = parsePodcastMetadata(
			eventWith([
				['title', 'Podcast title'],
				['image', 'https://example.com/podcast.webp'],
				['description', 'Podcast description'],
				['website', 'https://example.com'],
				['website', 'https://example.org']
			])
		);

		expect(metadata).toEqual({
			title: 'Podcast title',
			image: 'https://example.com/podcast.webp',
			description: 'Podcast description',
			websites: ['https://example.com', 'https://example.org']
		});
	});

	it('handles missing, unrelated, and incomplete tags', () => {
		expect(
			parsePodcastMetadata(eventWith([[], ['website'], ['website', ''], ['p', 'pubkey']]))
		).toEqual({
			title: undefined,
			image: undefined,
			description: undefined,
			websites: []
		});
	});
});
