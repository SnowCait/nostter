import { describe, it, expect } from 'vitest';
import { Twitter } from './Twitter';

describe('Tweet URL', () => {
	it('tweet', async () => {
		expect(Twitter.isTweetUrl('https://x.com/snow_cait/status/1719268738745446576')).toBe(true);
		expect(Twitter.isTweetUrl('https://twitter.com/snow_cait/status/1719268738745446576')).toBe(
			true
		);
	});
	it('url', async () => {
		expect(
			Twitter.isTweetUrl(new URL('https://x.com/snow_cait/status/1719268738745446576'))
		).toBe(true);
	});
	it('not tweet', async () => {
		expect(Twitter.isTweetUrl('https://x.com/snow_cait')).toBe(false);
	});
	it('not Twitter', async () => {
		expect(Twitter.isTweetUrl('https://example.com/snow_cait/status/1719268738745446576')).toBe(
			false
		);
	});
});
