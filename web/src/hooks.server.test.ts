import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { notFound } from './hooks.server';

type Resolve = Parameters<typeof notFound>[0]['resolve'];

const createEvent = ({
	path = '/',
	method = 'GET',
	headers = {},
	routeId = null
}: {
	path?: string;
	method?: string;
	headers?: Record<string, string>;
	routeId?: string | null;
} = {}): RequestEvent => {
	const url = new URL(`https://nostter.app${path}`);
	return {
		request: new Request(url, { method, headers }),
		url,
		route: { id: routeId }
	} as unknown as RequestEvent;
};

const createResolve = (response: Response): Resolve => vi.fn(async () => response);

const spyOnInfo = () => vi.spyOn(console, 'info').mockImplementation(() => {});

let info: ReturnType<typeof spyOnInfo>;

beforeEach(() => {
	info = spyOnInfo();
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('404 request logging', () => {
	it('logs a single structured entry for 404 responses', async () => {
		const event = createEvent({
			path: '/.env',
			headers: {
				'cf-connecting-ip': '203.0.113.10',
				'cf-ray': '8f0a1b2c3d4e5f60-NRT',
				'user-agent': 'curl/8.5.0'
			}
		});

		await notFound({ event, resolve: createResolve(new Response(null, { status: 404 })) });

		expect(info).toHaveBeenCalledTimes(1);
		expect(info).toHaveBeenCalledWith({
			event: 'http_not_found',
			clientIp: '203.0.113.10',
			method: 'GET',
			path: '/.env',
			routeId: null,
			rayId: '8f0a1b2c3d4e5f60-NRT',
			userAgent: 'curl/8.5.0'
		});
	});

	it('logs the matched route id when a route produced the 404', async () => {
		const event = createEvent({ path: '/npub1nonexistent', routeId: '/(app)/[slug=npub]' });

		await notFound({ event, resolve: createResolve(new Response(null, { status: 404 })) });

		expect(info.mock.calls[0][0]).toMatchObject({ routeId: '/(app)/[slug=npub]' });
	});

	it('logs the request method', async () => {
		const event = createEvent({ path: '/wp-login.php', method: 'POST' });

		await notFound({ event, resolve: createResolve(new Response(null, { status: 404 })) });

		expect(info.mock.calls[0][0]).toMatchObject({ method: 'POST' });
	});

	it.each([200, 204, 301, 403, 500])('does not log for %i responses', async (status) => {
		const event = createEvent({ path: '/.env' });

		await notFound({ event, resolve: createResolve(new Response(null, { status })) });

		expect(info).not.toHaveBeenCalled();
	});

	it('logs null instead of throwing when Cloudflare headers are absent', async () => {
		const event = createEvent({ path: '/graphql' });

		await expect(
			notFound({ event, resolve: createResolve(new Response(null, { status: 404 })) })
		).resolves.toBeInstanceOf(Response);

		expect(info).toHaveBeenCalledWith({
			event: 'http_not_found',
			clientIp: null,
			method: 'GET',
			path: '/graphql',
			routeId: null,
			rayId: null,
			userAgent: null
		});
	});

	it('logs only the pathname and omits sensitive request data', async () => {
		const event = createEvent({
			path: '/admin/login?redirect=%2Fsecret&token=s3cret',
			headers: {
				cookie: 'session=cookie-value',
				authorization: 'Bearer token-value',
				referer: 'https://evil.example.com/referer-value',
				'cf-connecting-ip': '203.0.113.10'
			}
		});

		await notFound({ event, resolve: createResolve(new Response(null, { status: 404 })) });

		const logged = info.mock.calls[0][0] as Record<string, unknown>;
		expect(Object.keys(logged).sort()).toStrictEqual([
			'clientIp',
			'event',
			'method',
			'path',
			'rayId',
			'routeId',
			'userAgent'
		]);
		expect(logged.path).toBe('/admin/login');
		expect(JSON.stringify(logged)).not.toMatch(
			/cookie-value|token-value|referer-value|redirect|s3cret|nostter\.app/
		);
	});

	it.each([200, 404])('returns the %i response of the inner hooks untouched', async (status) => {
		const resolved = new Response('<html lang="ja"></html>', {
			status,
			headers: { 'Content-Security-Policy': "default-src 'self'" }
		});
		const event = createEvent({ path: '/' });

		const response = await notFound({ event, resolve: createResolve(resolved) });

		expect(response).toBe(resolved);
		expect(response.status).toBe(status);
		expect(response.headers.get('Content-Security-Policy')).toBe("default-src 'self'");
		expect(await response.text()).toBe('<html lang="ja"></html>');
	});
});
