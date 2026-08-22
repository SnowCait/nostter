import { describe, expect, it } from 'vitest';

import { resolveProxyUrl } from './ProxyLink';

describe('resolveProxyUrl', () => {
	it('converts an atproto Bluesky post AT URI to its web URL', () => {
		const url = resolveProxyUrl(
			'at://did:plc:bubr6jwtzi5j65ja4hq7bmb5/app.bsky.feed.post/3moyc6q5o422m',
			'atproto'
		);

		expect(url?.href).toBe(
			'https://bsky.app/profile/did:plc:bubr6jwtzi5j65ja4hq7bmb5/post/3moyc6q5o422m'
		);
	});

	it('does not link an unsupported atproto collection', () => {
		expect(
			resolveProxyUrl(
				'at://did:plc:bubr6jwtzi5j65ja4hq7bmb5/app.bsky.feed.like/3moyc6q5o422m',
				'atproto'
			)
		).toBeUndefined();
	});

	it('does not link a malformed AT URI', () => {
		expect(
			resolveProxyUrl('at://did:plc:example/app.bsky.feed.post', 'atproto')
		).toBeUndefined();
	});

	it('keeps URL-based protocol behavior', () => {
		expect(resolveProxyUrl('https://example.com/posts/1', 'activitypub')?.href).toBe(
			'https://example.com/posts/1'
		);
	});
});
