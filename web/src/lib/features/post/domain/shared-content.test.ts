import { describe, expect, it } from 'vitest';
import { sharedContent } from './shared-content';

describe('sharedContent', () => {
	it('joins distinct text and URLs while dropping repeated or contained values', () => {
		expect(sharedContent('Article', 'Article https://example.com', 'https://example.com')).toBe(
			'Article https://example.com'
		);
		expect(sharedContent('Title', 'Text', 'https://example.com')).toBe(
			'Title\nText\nhttps://example.com'
		);
		expect(sharedContent(null, 'https://example.com', '')).toBe('https://example.com');
	});
});
