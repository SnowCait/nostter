import { describe, expect, it } from 'vitest';

import { newUrl } from './Helper';
import { isAudioResourceUrl, isHttpUrl, isImageResourceUrl, isSimplexSmpUrl } from './url';

function isAllowedResourceUrl(value: string, isAllowed: (url: URL) => boolean): boolean {
	const url = newUrl(value);
	return url !== undefined && isAllowed(url);
}

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

describe('isImageResourceUrl', () => {
	it.each([
		['HTTPS', 'https://example.com/image.webp', true],
		['HTTP', 'http://example.com/image.webp', true],
		['PNG data', 'data:image/png;base64,AAAA', true],
		['SVG data', 'data:image/svg+xml,<svg></svg>', true],
		['HTML data', 'data:text/html,<p>example</p>', false],
		['JavaScript', 'javascript:alert(1)', false],
		['file', 'file:///tmp/image.png', false],
		['blob', 'blob:https://example.com/id', false],
		['malformed', 'not a URL', false]
	])('%s URLs are handled as expected', (_description, value, expected) => {
		expect(isAllowedResourceUrl(value, isImageResourceUrl)).toBe(expected);
	});
});

describe('isAudioResourceUrl', () => {
	it.each([
		['HTTPS', 'https://example.com/episode.mp3', true],
		['HTTP', 'http://example.com/episode.mp3', true],
		['audio data', 'data:audio/mpeg;base64,AAAA', false],
		['blob', 'blob:https://example.com/id', false],
		['JavaScript', 'javascript:alert(1)', false],
		['file', 'file:///tmp/episode.mp3', false],
		['malformed', 'not a URL', false]
	])('%s URLs are handled as expected', (_description, value, expected) => {
		expect(isAllowedResourceUrl(value, isAudioResourceUrl)).toBe(expected);
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
