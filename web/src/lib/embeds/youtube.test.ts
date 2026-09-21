import { describe, expect, it } from 'vitest';
import { isYouTubeUrl } from './youtube';

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
