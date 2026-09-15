import { describe, expect, it } from 'vitest';
import { newUrl } from '$lib/Helper';
import { isAudioResourceUrl, isImageResourceUrl } from './resource-url';

function isAllowedResourceUrl(value: string, isAllowed: (url: URL) => boolean): boolean {
	const url = newUrl(value);
	return url !== undefined && isAllowed(url);
}

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
