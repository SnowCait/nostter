import { describe, expect, it } from 'vitest';
import { contentFontSizes, parseContentFontSize } from './content-font-size';

describe('parseContentFontSize', () => {
	it.each(contentFontSizes)('accepts %s', (size) => {
		expect(parseContentFontSize(size)).toBe(size);
	});

	it.each([null, '', 'medium', 'Large', '1.25', ' large'])(
		'falls back to default for %j',
		(value) => {
			expect(parseContentFontSize(value)).toBe('default');
		}
	);
});
