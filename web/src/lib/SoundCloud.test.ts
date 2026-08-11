import { afterEach, describe, expect, it, vi } from 'vitest';
import { SoundCloud } from './SoundCloud';

const contentUrl = 'https://soundcloud.com/user/track';
const playerUrl = 'https://w.soundcloud.com/player/?url=track';

afterEach(() => vi.unstubAllGlobals());

describe('SoundCloud URL', () => {
	it.each([contentUrl, 'https://www.soundcloud.com/user/sets/playlist'])('accepts %s', (url) => {
		expect(SoundCloud.isSoundCloudUrl(url)).toBe(true);
	});

	it.each([
		'not a URL',
		'http://soundcloud.com/user/track',
		'https://soundcloud.com',
		'https://api.soundcloud.com/user/track',
		'https://soundcloud.example/user/track'
	])('rejects %s', (url) => {
		expect(SoundCloud.isSoundCloudUrl(url)).toBe(false);
	});

	it('generates an oEmbed URL', () => {
		const url = SoundCloud.getOEmbedUrl(contentUrl);
		expect(url?.href).toBe(
			'https://soundcloud.com/oembed?format=json&url=https%3A%2F%2Fsoundcloud.com%2Fuser%2Ftrack'
		);
	});
});

describe('SoundCloud oEmbed', () => {
	function stubPlayer(src = playerUrl): void {
		vi.stubGlobal(
			'DOMParser',
			class {
				parseFromString() {
					return {
						querySelector: () => ({ getAttribute: () => src })
					};
				}
			}
		);
	}

	it('parses the official player', () => {
		stubPlayer();
		expect(
			SoundCloud.parseOEmbedResponse({
				html: '<iframe></iframe>',
				title: 'Track',
				height: 166
			})
		).toStrictEqual({ src: new URL(playerUrl), title: 'Track', height: 166 });
	});

	it('rejects a player from another origin', () => {
		stubPlayer('https://example.com/player/');
		expect(
			SoundCloud.parseOEmbedResponse({
				html: '<iframe></iframe>',
				title: 'Track',
				height: 166
			})
		).toBeUndefined();
	});

	it('fetches and parses oEmbed data', async () => {
		stubPlayer();
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => ({
				ok: true,
				json: async () => ({ html: '<iframe></iframe>', title: 'Track', height: 166 })
			}))
		);

		expect(await SoundCloud.fetchEmbed(contentUrl)).toMatchObject({ title: 'Track' });
	});
});
