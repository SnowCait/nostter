import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { handleError, httpStatusLogging } from './hooks.server';

vi.mock('$lib/build', () => ({ gitSha: '0123456789abcdef' }));

type Resolve = Parameters<typeof httpStatusLogging>[0]['resolve'];

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

const sensitiveEvent = () =>
	createEvent({
		path: '/admin/login?redirect=%2Fsecret&token=s3cret',
		method: 'POST',
		routeId: '/(app)/[slug]',
		headers: {
			cookie: 'session=cookie-value',
			authorization: 'Bearer token-value',
			referer: 'https://evil.example.com/referer-value',
			'cf-connecting-ip': '203.0.113.10',
			'user-agent': 'curl/8.5.0'
		}
	});

const expectedRequest = {
	method: 'POST',
	path: '/admin/login',
	routeId: '/(app)/[slug]',
	userAgent: 'curl/8.5.0'
};

const sensitivePattern = /cookie-value|token-value|referer-value|redirect|s3cret|nostter\.app/;

let info: ReturnType<typeof vi.spyOn>;
let error: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
	info = vi.spyOn(console, 'info').mockImplementation(() => {});
	error = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('httpStatusLogging', () => {
	it('logs 404 responses with request metadata only', async () => {
		await httpStatusLogging({
			event: sensitiveEvent(),
			resolve: createResolve(new Response(null, { status: 404 }))
		});

		expect(info).toHaveBeenCalledTimes(1);
		expect(error).not.toHaveBeenCalled();
		const logged = info.mock.calls[0][0];
		expect(logged).toStrictEqual({ message: 'http-not-found', request: expectedRequest });
		expect(JSON.stringify(logged)).not.toMatch(sensitivePattern);
		expect(JSON.stringify(logged)).not.toContain('203.0.113.10');
	});

	it('logs null user agent when the header is absent', async () => {
		await httpStatusLogging({
			event: createEvent({ path: '/graphql' }),
			resolve: createResolve(new Response(null, { status: 404 }))
		});

		expect(info).toHaveBeenCalledWith({
			message: 'http-not-found',
			request: { method: 'GET', path: '/graphql', routeId: null, userAgent: null }
		});
	});

	it.each([500, 502, 503])('logs %i responses as server errors', async (status) => {
		await httpStatusLogging({
			event: sensitiveEvent(),
			resolve: createResolve(new Response(null, { status }))
		});

		expect(error).toHaveBeenCalledTimes(1);
		expect(info).not.toHaveBeenCalled();
		const logged = error.mock.calls[0][0];
		expect(logged).toStrictEqual({
			message: 'http-server-error',
			request: expectedRequest,
			response: { status },
			server: { gitSha: '0123456789abcdef' }
		});
		expect(JSON.stringify(logged)).not.toMatch(sensitivePattern);
		expect(JSON.stringify(logged)).not.toContain('203.0.113.10');
	});

	it.each([200, 204, 301, 304, 400, 403, 410])('does not log %i responses', async (status) => {
		await httpStatusLogging({
			event: createEvent({ path: '/' }),
			resolve: createResolve(new Response(null, { status }))
		});

		expect(info).not.toHaveBeenCalled();
		expect(error).not.toHaveBeenCalled();
	});

	it.each([200, 404, 500, 503])('returns the %i response untouched', async (status) => {
		const resolved = new Response('<html lang="ja"></html>', {
			status,
			headers: { 'Content-Security-Policy': "default-src 'self'" }
		});

		const response = await httpStatusLogging({
			event: createEvent({ path: '/' }),
			resolve: createResolve(resolved)
		});

		expect(response).toBe(resolved);
		expect(response.status).toBe(status);
		expect(response.headers.get('Content-Security-Policy')).toBe("default-src 'self'");
		expect(await response.text()).toBe('<html lang="ja"></html>');
	});
});

describe('handleError', () => {
	it('logs the error object with its status and returns only the message', async () => {
		const thrown = new Error('database exploded');

		const result = await handleError({
			error: thrown,
			event: sensitiveEvent(),
			status: 500,
			message: 'Internal Error'
		});

		expect(error).toHaveBeenCalledTimes(1);
		expect(error).toHaveBeenCalledWith(
			{ message: 'server-unexpected-error', response: { status: 500 } },
			thrown
		);
		expect(error.mock.calls[0][1]).toBe(thrown);
		expect(result).toStrictEqual({ message: 'Internal Error' });
	});
});
