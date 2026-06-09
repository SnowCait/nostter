import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchOgp, fetchOgpViaProxy } from './ogp';

function jsonResponse(body: Record<string, string>, init?: { ok?: boolean; contentType?: string }) {
	return {
		ok: init?.ok ?? true,
		status: init?.ok === false ? 500 : 200,
		headers: new Headers({ 'Content-Type': init?.contentType ?? 'application/json' }),
		json: async () => body,
		text: async () => JSON.stringify(body)
	} as unknown as Response;
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('fetchOgpViaProxy', () => {
	it('maps og:title and og:image', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () =>
				jsonResponse({ 'og:title': 'Title', 'og:image': 'https://example.com/i.png' })
			)
		);
		expect(await fetchOgpViaProxy(new URL('https://example.com'))).toStrictEqual({
			title: 'Title',
			image: 'https://example.com/i.png'
		});
	});

	it('falls back to title when og:title is missing', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => jsonResponse({ title: 'Fallback' }))
		);
		expect(await fetchOgpViaProxy(new URL('https://example.com'))).toStrictEqual({
			title: 'Fallback',
			image: undefined
		});
	});

	it('sends Accept: application/json to the proxy', async () => {
		const fetchMock = vi.fn(async () => jsonResponse({ title: 'x' }));
		vi.stubGlobal('fetch', fetchMock);
		await fetchOgpViaProxy(new URL('https://example.com'));
		const [, init] = fetchMock.mock.calls[0] as unknown as [unknown, RequestInit?];
		expect(new Headers(init?.headers).get('Accept')).toBe('application/json');
	});

	it('returns undefined when response is not ok', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => jsonResponse({}, { ok: false }))
		);
		expect(await fetchOgpViaProxy(new URL('https://example.com'))).toBeUndefined();
	});

	it('returns undefined when content type is not json', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => jsonResponse({}, { contentType: 'text/html' }))
		);
		expect(await fetchOgpViaProxy(new URL('https://example.com'))).toBeUndefined();
	});

	it('returns undefined on network error', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				throw new TypeError('Failed to fetch');
			})
		);
		expect(await fetchOgpViaProxy(new URL('https://example.com'))).toBeUndefined();
	});
});

describe('fetchOgp', () => {
	it('falls back to a direct fetch when the proxy yields nothing', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(jsonResponse({}, { ok: false }))
			.mockResolvedValueOnce({
				ok: true,
				status: 200,
				headers: new Headers({ 'Content-Type': 'text/plain' }),
				text: async () => 'not html'
			} as unknown as Response);
		vi.stubGlobal('fetch', fetchMock);

		expect(await fetchOgp(new URL('https://example.com'))).toBeUndefined();
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it('does not fetch directly when the proxy succeeds', async () => {
		const fetchMock = vi.fn(async () => jsonResponse({ 'og:title': 'Title' }));
		vi.stubGlobal('fetch', fetchMock);

		expect(await fetchOgp(new URL('https://example.com'))).toStrictEqual({
			title: 'Title',
			image: undefined
		});
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});
