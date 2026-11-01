import { describe, expect, it } from 'vitest';

import { isAllowedLinkScheme, isHttpUrl, isSimplexSmpUrl } from './url';

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

describe('isAllowedLinkScheme', () => {
	it.each([
		['http://example.com', true],
		['https://example.com', true],
		['spotify:track:123', true],
		['custom-app:resource', true],
		['javascript:alert(1)', false],
		['data:text/html,example', false],
		['vbscript:msgbox(1)', false],
		['VbScRiPt:msgbox(1)', false],
		['JaVaScRiPt:alert(1)', false],
		['DaTa:text/html,example', false],
		['java\nscript:alert(1)', false],
		['da\tta:text/html,example', false],
		['not a URI', false]
	])('checks %s', (value, expected) => {
		expect(isAllowedLinkScheme(URL.parse(value))).toBe(expected);
	});
});
