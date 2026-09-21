import { describe, expect, it } from 'vitest';

import { isHttpUrl, isSimplexSmpUrl, isYouTubeUrl } from './url';

describe('isHttpUrl', () => {
	it.each([
		['https:', 'https://example.com', true],
		['http:', 'http://example.com', true],
		['javascript:', 'javascript:alert(1)', false],
		['data:', 'data:text/html,example', false]
	])('returns the expected result for %s URLs', (_scheme, value, expected) => {
		expect(isHttpUrl(new URL(value))).toBe(expected);
	});
});

describe('isSimplexSmpUrl', () => {
	it.each([
		['preset SMP server', 'https://smp11.simplex.im', true],
		['SMP server with port and path', 'https://smp8.simplex.im:443/example', true],
		['XFTP server', 'https://xftp8.simplex.im', false],
		['other SimpleX subdomain', 'https://www.simplex.im', false],
		['SMP-like nested subdomain', 'https://smp8.simplex.im.example.com', false],
		['SMP hostname without a number', 'https://smp.simplex.im', false]
	])('identifies %s', (_description, value, expected) => {
		expect(isSimplexSmpUrl(new URL(value))).toBe(expected);
	});
});

describe('isYouTubeUrl', () => {
	it.each([
		['YouTube URL', 'https://www.youtube.com/embed/M7lc1UVf-VE', true],
		['YouTube short URL', 'https://youtu.be/M7lc1UVf-VE', true],
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
