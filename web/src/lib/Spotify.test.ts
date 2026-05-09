import { describe, expect, it } from 'vitest';
import { Spotify } from './Spotify';

describe('Spotify URL', () => {
	it('track', async () => {
		expect(Spotify.isSpotifyUrl('https://open.spotify.com/track/1234567890abcdef')).toBe(true);
	});

	it('intl path', async () => {
		expect(
			Spotify.getEmbedUrl('https://open.spotify.com/intl-ja/album/1234567890abcdef?si=test')
				?.href
		).toBe('https://open.spotify.com/embed/album/1234567890abcdef?si=test');
	});

	it('already embed', async () => {
		expect(
			Spotify.getEmbedUrl('https://open.spotify.com/embed/playlist/1234567890abcdef')?.href
		).toBe('https://open.spotify.com/embed/playlist/1234567890abcdef');
	});

	it('not Spotify', async () => {
		expect(Spotify.isSpotifyUrl('https://example.com/track/1234567890abcdef')).toBe(false);
	});

	it('unsupported path', async () => {
		expect(Spotify.isSpotifyUrl('https://open.spotify.com/user/1234567890abcdef')).toBe(false);
	});
});
