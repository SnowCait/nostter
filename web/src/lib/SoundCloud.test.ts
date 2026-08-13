import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SoundCloud } from './SoundCloud';

const contentUrl = 'https://soundcloud.com/user/track';
const playerUrl = 'https://w.soundcloud.com/player/?url=track';

type TestElement = {
	tagName: string;
	getAttribute(name: string): string | null;
};

class TestDOMParser {
	parseFromString(html: string) {
		const elements = [
			...html.matchAll(/<\s*(script|object|embed|style|iframe|div|p)\b([^>]*)>/gis)
		].map(([, tagName, attributes]) => ({
			tagName: tagName.toUpperCase(),
			getAttribute(name: string): string | null {
				const match = attributes.match(
					new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i')
				);
				return match?.[1] ?? match?.[2] ?? match?.[3] ?? null;
			}
		}));
		const topLevelElements: TestElement[] = [];
		let depth = 0;
		for (const match of html.matchAll(
			/<\s*(\/)?\s*(script|object|embed|style|iframe|div|p)\b([^>]*)>/gis
		)) {
			const [, closing, tagName, attributes] = match;
			if (closing !== undefined) {
				depth = Math.max(0, depth - 1);
				continue;
			}
			if (depth === 0) {
				topLevelElements.push({
					tagName: tagName.toUpperCase(),
					getAttribute(name: string): string | null {
						const attribute = attributes.match(
							new RegExp(
								`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
								'i'
							)
						);
						return attribute?.[1] ?? attribute?.[2] ?? attribute?.[3] ?? null;
					}
				});
			}
			if (!attributes.trimEnd().endsWith('/')) {
				depth += 1;
			}
		}

		return {
			body: {
				children: topLevelElements,
				firstElementChild: topLevelElements[0] ?? null
			},
			querySelector: (selector: string) => {
				const forbidden = selector.split(',').map((tag) => tag.trim().toUpperCase());
				return elements.find((element) => forbidden.includes(element.tagName)) ?? null;
			}
		};
	}
}

function validResponse(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		version: 1,
		type: 'rich',
		provider_name: 'SoundCloud',
		provider_url: 'https://soundcloud.com',
		html: `<iframe src="${playerUrl}"></iframe>`,
		title: 'Track',
		height: 166,
		...overrides
	};
}

beforeEach(() => vi.stubGlobal('DOMParser', TestDOMParser));
afterEach(() => vi.unstubAllGlobals());

describe('SoundCloud URL', () => {
	it.each([contentUrl, 'https://www.soundcloud.com/user/sets/playlist'])('accepts %s', (url) => {
		expect(SoundCloud.isSoundCloudUrl(url)).toBe(true);
	});

	it('accepts an on.soundcloud.com URL', () => {
		expect(SoundCloud.isSoundCloudUrl('https://on.soundcloud.com/AbCdEf123456')).toBe(true);
	});

	it.each([
		'not a URL',
		'http://soundcloud.com/user/track',
		'https://soundcloud.com',
		'https://api.soundcloud.com/user/track',
		'https://soundcloud.example/user/track'
	])('rejects %s', (url) => {
		expect(SoundCloud.isSoundCloudUrl(url)).toBe(false);
	});

	it('generates an oEmbed URL with autoplay disabled', () => {
		const url = SoundCloud.getOEmbedUrl(contentUrl);
		expect(url?.origin).toBe('https://soundcloud.com');
		expect(url?.pathname).toBe('/oembed');
		expect(url?.searchParams.get('format')).toBe('json');
		expect(url?.searchParams.get('url')).toBe(contentUrl);
		expect(url?.searchParams.get('auto_play')).toBe('false');
	});
});

describe('SoundCloud oEmbed response', () => {
	it('parses a valid response', () => {
		expect(SoundCloud.parseOEmbedResponse(validResponse())).toStrictEqual({
			src: new URL(playerUrl),
			title: 'Track',
			height: 166
		});
	});

	it.each([
		['null', null],
		['array', []],
		['invalid version', validResponse({ version: '1.0' })],
		['non-rich type', validResponse({ type: 'video' })],
		['another provider', validResponse({ provider_name: 'Example' })],
		['another provider origin', validResponse({ provider_url: 'https://example.com' })],
		[
			'similar provider domain',
			validResponse({ provider_url: 'https://soundcloud.com.example' })
		],
		['provider userinfo', validResponse({ provider_url: 'https://user@soundcloud.com' })],
		['provider port', validResponse({ provider_url: 'https://soundcloud.com:8443' })],
		['missing html', validResponse({ html: undefined })],
		['empty html', validResponse({ html: '   ' })],
		['non-numeric height', validResponse({ height: '166' })],
		['NaN height', validResponse({ height: Number.NaN })],
		['infinite height', validResponse({ height: Number.POSITIVE_INFINITY })]
	])('rejects %s', (_name, response) => {
		expect(SoundCloud.parseOEmbedResponse(response)).toBeUndefined();
	});

	it.each([
		[undefined, 166],
		[0, 81],
		[80, 81],
		[451, 450],
		[100_000, 450]
	])('clamps height %s to %s', (height, expected) => {
		expect(SoundCloud.parseOEmbedResponse(validResponse({ height }))?.height).toBe(expected);
	});

	it.each([undefined, null, '', '   ', 123])('uses a fallback title for %s', (title) => {
		expect(SoundCloud.parseOEmbedResponse(validResponse({ title }))?.title).toBe(
			'SoundCloud player'
		);
	});
});

describe('SoundCloud oEmbed HTML', () => {
	it('accepts one top-level iframe', () => {
		expect(SoundCloud.parseOEmbedResponse(validResponse())).toBeDefined();
	});

	it.each([
		['another top-level element', `<div></div>`],
		['multiple top-level elements', `<iframe src="${playerUrl}"></iframe><div></div>`],
		['an iframe and script', `<iframe src="${playerUrl}"></iframe><script></script>`],
		['a nested script', `<iframe src="${playerUrl}"><script></script></iframe>`],
		['an object', `<iframe src="${playerUrl}"></iframe><object></object>`],
		['an embed element', `<iframe src="${playerUrl}"></iframe><embed>`],
		['a style element', `<iframe src="${playerUrl}"></iframe><style></style>`],
		['an iframe without src', '<iframe></iframe>']
	])('rejects %s', (_name, html) => {
		expect(SoundCloud.parseOEmbedResponse(validResponse({ html }))).toBeUndefined();
	});
});

describe('SoundCloud player URL', () => {
	it.each([playerUrl, 'https://w.soundcloud.com/player?url=track'])('accepts %s', (src) => {
		expect(
			SoundCloud.parseOEmbedResponse(
				validResponse({ html: `<iframe src="${src}"></iframe>` })
			)
		).toBeDefined();
	});

	it.each([
		'http://w.soundcloud.com/player',
		'https://example.com/player',
		'https://w.soundcloud.com.example/player',
		'https://sub.w.soundcloud.com/player',
		'https://user@w.soundcloud.com/player',
		'https://w.soundcloud.com:8443/player',
		'https://w.soundcloud.com/players',
		'https://w.soundcloud.com/other'
	])('rejects %s', (src) => {
		expect(
			SoundCloud.parseOEmbedResponse(
				validResponse({ html: `<iframe src="${src}"></iframe>` })
			)
		).toBeUndefined();
	});
});

describe('SoundCloud fetch', () => {
	function response(options: { ok?: boolean; json?: () => Promise<unknown> } = {}): Response {
		return {
			ok: options.ok ?? true,
			json: options.json ?? (async () => validResponse())
		} as Response;
	}

	it('fetches and validates oEmbed data without real network access', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => response())
		);
		expect(await SoundCloud.fetchEmbed(contentUrl)).toMatchObject({ title: 'Track' });
	});

	it('passes the abort signal to fetch', async () => {
		const fetchMock = vi.fn(async () => response());
		vi.stubGlobal('fetch', fetchMock);
		const controller = new AbortController();
		await SoundCloud.fetchEmbed(contentUrl, controller.signal);
		expect(fetchMock).toHaveBeenCalledWith(expect.any(URL), { signal: controller.signal });
	});

	it('returns undefined for an HTTP error', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => response({ ok: false }))
		);
		expect(await SoundCloud.fetchEmbed(contentUrl)).toBeUndefined();
	});

	it('returns undefined for a JSON error', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () =>
				response({ json: async () => Promise.reject(new SyntaxError('JSON')) })
			)
		);
		expect(await SoundCloud.fetchEmbed(contentUrl)).toBeUndefined();
	});

	it('returns undefined when aborted', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => Promise.reject(new DOMException('Aborted', 'AbortError')))
		);
		expect(
			await SoundCloud.fetchEmbed(contentUrl, new AbortController().signal)
		).toBeUndefined();
	});

	it('returns undefined when oEmbed validation fails', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => response({ json: async () => validResponse({ type: 'video' }) }))
		);
		expect(await SoundCloud.fetchEmbed(contentUrl)).toBeUndefined();
	});
});
