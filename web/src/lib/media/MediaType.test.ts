import { describe, it, expect } from 'vitest';
import { mediaKindFromContentType, mediaKindFromPathname } from './MediaType';

describe('mediaKindFromPathname', () => {
	it('detects image extensions', () => {
		expect(mediaKindFromPathname('/photo.jpg')).toBe('image');
		expect(mediaKindFromPathname('/photo.png')).toBe('image');
		expect(mediaKindFromPathname('/photo.webp')).toBe('image');
	});

	it('detects audio extensions', () => {
		expect(mediaKindFromPathname('/sound.mp3')).toBe('audio');
		expect(mediaKindFromPathname('/sound.ogg')).toBe('audio');
	});

	it('detects video extensions', () => {
		expect(mediaKindFromPathname('/clip.mp4')).toBe('video');
		expect(mediaKindFromPathname('/clip.ogv')).toBe('video');
	});

	it('is case insensitive', () => {
		expect(mediaKindFromPathname('/PHOTO.JPG')).toBe('image');
	});

	it('matches against the pathname without the query string', () => {
		expect(mediaKindFromPathname(new URL('https://example.com/a.png?x=1').pathname)).toBe(
			'image'
		);
	});

	it('returns undefined for unknown or missing extensions', () => {
		expect(mediaKindFromPathname('/article')).toBeUndefined();
		expect(mediaKindFromPathname('/file.txt')).toBeUndefined();
		expect(mediaKindFromPathname('')).toBeUndefined();
	});
});

describe('mediaKindFromContentType', () => {
	it('detects the kind from the content type', () => {
		expect(mediaKindFromContentType('image/png')).toBe('image');
		expect(mediaKindFromContentType('audio/mpeg')).toBe('audio');
		expect(mediaKindFromContentType('video/mp4')).toBe('video');
	});

	it('returns undefined for non-media content types', () => {
		expect(mediaKindFromContentType('text/html')).toBeUndefined();
		expect(mediaKindFromContentType('application/json')).toBeUndefined();
		expect(mediaKindFromContentType('')).toBeUndefined();
	});
});
