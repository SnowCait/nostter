import { describe, expect, it } from 'vitest';

import { isHttpUrl } from './url';

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
