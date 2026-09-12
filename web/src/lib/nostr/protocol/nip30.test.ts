import { describe, expect, it } from 'vitest';
import { filterEmojiTags } from './nip30';

describe('filterEmojiTags', () => {
	it('returns valid emoji tags', () => {
		const tags = [['emoji', 'smile', 'https://example.com/smile.png']];
		expect(filterEmojiTags(tags)).toEqual(tags);
	});

	it('accepts alphanumeric, hyphen, and underscore shortcodes', () => {
		const tags = [
			['emoji', 'smile2', 'https://example.com/smile.png'],
			['emoji', 'thumbs-up', 'https://example.com/thumbs-up.png'],
			['emoji', 'under_score', 'https://example.com/under_score.png']
		];
		expect(filterEmojiTags(tags)).toEqual(tags);
	});

	it('excludes invalid shortcodes', () => {
		const tags = [
			['emoji', 'smile!', 'https://example.com/smile.png'],
			['emoji', 'smile space', 'https://example.com/smile.png'],
			['emoji', ':smile:', 'https://example.com/smile.png']
		];
		expect(filterEmojiTags(tags)).toEqual([]);
	});

	it('excludes tags missing a shortcode or image URL', () => {
		const missingShortcode = [
			'emoji',
			undefined,
			'https://example.com/smile.png'
		] as unknown as string[];
		const missingUrl = ['emoji', 'smile'];
		expect(filterEmojiTags([missingShortcode, missingUrl])).toEqual([]);
	});

	it('excludes tags with an unparseable image URL', () => {
		expect(filterEmojiTags([['emoji', 'smile', 'not a url']])).toEqual([]);
	});

	it('excludes non-emoji tags', () => {
		const tags = [
			['emoji', 'smile', 'https://example.com/smile.png'],
			['p', 'pubkey'],
			['e', 'event-id']
		];
		expect(filterEmojiTags(tags)).toEqual([tags[0]]);
	});
});
