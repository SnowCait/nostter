import { describe, expect, it } from 'vitest';
import { getYouTubeEmbed, isYouTubeUrl } from './youtube';

describe('isYouTubeUrl', () => {
	it.each([
		['YouTube URL', 'https://www.youtube.com/embed/M7lc1UVf-VE', true],
		['YouTube root domain', 'https://youtube.com/watch?v=M7lc1UVf-VE', true],
		['YouTube subdomain', 'https://music.youtube.com/watch?v=M7lc1UVf-VE', true],
		['YouTube short URL', 'https://youtu.be/M7lc1UVf-VE', true],
		['YouTube channel URL', 'https://www.youtube.com/@YouTube', false],
		['unrelated hostname', 'https://notyoutube.com/watch?v=M7lc1UVf-VE', false],
		['privacy-enhanced embed URL', 'https://www.youtube-nocookie.com/embed/M7lc1UVf-VE', true],
		['privacy-enhanced root domain', 'https://youtube-nocookie.com/embed/M7lc1UVf-VE', false],
		[
			'privacy-enhanced subdomain',
			'https://embed.youtube-nocookie.com/embed/M7lc1UVf-VE',
			false
		],
		[
			'privacy-enhanced non-embed URL',
			'https://www.youtube-nocookie.com/watch?v=M7lc1UVf-VE',
			false
		]
	])('identifies %s', (_description, value, expected) => {
		expect(isYouTubeUrl(new URL(value))).toBe(expected);
	});
});

function embed(link: string) {
	return getYouTubeEmbed(new URL(link), 'https://nostter.example');
}

describe('getYouTubeEmbed', () => {
	it.each([
		['youtu.be', 'https://youtu.be/M7lc1UVf-VE', false],
		['watch URL', 'https://www.youtube.com/watch?v=M7lc1UVf-VE', false],
		['embed URL', 'https://www.youtube.com/embed/M7lc1UVf-VE', false],
		['live URL', 'https://www.youtube.com/live/M7lc1UVf-VE', false],
		['shorts URL', 'https://www.youtube.com/shorts/M7lc1UVf-VE', true],
		['privacy-enhanced embed URL', 'https://www.youtube-nocookie.com/embed/M7lc1UVf-VE', false]
	])('creates an embed for a %s', (_description, link, short) => {
		const result = embed(link);

		expect(result).toMatchObject({ short });
		expect(result?.src.pathname).toBe('/embed/M7lc1UVf-VE');
		expect(result?.src.searchParams.get('origin')).toBe('https://nostter.example');
	});

	it('uses only the first path segment as a youtu.be video ID', () => {
		expect(embed('https://youtu.be/M7lc1UVf-VE/extra')?.src.pathname).toBe(
			'/embed/M7lc1UVf-VE'
		);
	});

	it('uses only the first path segment as a live video ID', () => {
		expect(embed('https://www.youtube.com/live/M7lc1UVf-VE/extra')?.src.pathname).toBe(
			'/embed/M7lc1UVf-VE'
		);
	});

	it('preserves the privacy-enhanced embed host', () => {
		expect(embed('https://www.youtube-nocookie.com/embed/M7lc1UVf-VE')?.src.hostname).toBe(
			'www.youtube-nocookie.com'
		);
	});

	it.each(['https://www.youtube.com/embed/M7lc1UVf-VE', 'https://youtu.be/M7lc1UVf-VE'])(
		'uses the standard embed host for %s',
		(link) => {
			expect(embed(link)?.src.hostname).toBe('www.youtube.com');
		}
	);

	it.each([
		['90', '90'],
		['90s', '90'],
		['1m30s', '90'],
		['1h2m3s', '3723']
	])('converts t=%s to start=%s', (time, expectedStart) => {
		expect(
			embed(`https://www.youtube.com/embed/M7lc1UVf-VE?t=${time}`)?.src.searchParams.get(
				'start'
			)
		).toBe(expectedStart);
	});

	it('does not add start when t is absent', () => {
		expect(
			embed('https://www.youtube.com/embed/M7lc1UVf-VE')?.src.searchParams.has('start')
		).toBe(false);
	});

	it.each(['', '0', '-1', 'invalid', '1m30', '9007199254740992'])(
		'does not add start for an invalid t value of %s',
		(time) => {
			expect(
				embed(`https://www.youtube.com/embed/M7lc1UVf-VE?t=${time}`)?.src.searchParams.has(
					'start'
				)
			).toBe(false);
		}
	);

	it.each([
		'https://www.youtube.com/embed/',
		'https://www.youtube.com/live/',
		'https://www.youtube.com/shorts/',
		'https://www.youtube.com/watch',
		'https://youtu.be/'
	])('does not create an embed when %s has no video ID', (link) => {
		expect(embed(link)).toBeUndefined();
	});
});
