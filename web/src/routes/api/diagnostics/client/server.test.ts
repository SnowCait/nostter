import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './+server';

type Event = Parameters<typeof POST>[0];

const endpoint = 'https://nostter.app/api/diagnostics/client';

const validPayload = {
	type: 'stylesheet-load-error',
	pathname: '/[npub]/lists',
	stylesheetPath: '/_app/immutable/assets/0.Bx3k2Lm.css',
	stylesheetPaths: ['/_app/immutable/assets/0.Bx3k2Lm.css', '/_app/immutable/assets/2.C9dE.css'],
	stylesheetResponseStatuses: [503, 200],
	unavailableStylesheetPaths: ['/_app/immutable/assets/0.Bx3k2Lm.css'],
	timestamp: 1790000000000,
	standalone: true,
	serviceWorkerControlled: false
};

const post = (
	body: string,
	headers: Record<string, string> = {
		'content-type': 'application/json',
		origin: 'https://nostter.app',
		'user-agent': 'Mozilla/5.0'
	}
): Promise<Response> => {
	const url = new URL(endpoint);
	return Promise.resolve(
		POST({ request: new Request(url, { method: 'POST', headers, body }), url } as Event)
	);
};

const expectedLog = {
	message: 'client-css-diagnostic',
	diagnostic: {
		type: 'stylesheet-load-error',
		timestamp: 1790000000000,
		pathname: '/[npub]/lists',
		stylesheets: {
			failed: '/_app/immutable/assets/0.Bx3k2Lm.css',
			resources: [
				{ path: '/_app/immutable/assets/0.Bx3k2Lm.css', responseStatus: 503 },
				{ path: '/_app/immutable/assets/2.C9dE.css', responseStatus: 200 }
			],
			unavailable: ['/_app/immutable/assets/0.Bx3k2Lm.css']
		},
		client: {
			standalone: true,
			serviceWorkerControlled: false,
			userAgent: 'Mozilla/5.0'
		},
		server: {
			gitSha: expect.any(String)
		}
	}
};

const spyOnError = () => vi.spyOn(console, 'error').mockImplementation(() => {});

let error: ReturnType<typeof spyOnError>;

beforeEach(() => {
	error = spyOnError();
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('POST /api/diagnostics/client', () => {
	it('logs a structured error for a valid diagnostic', async () => {
		const response = await post(JSON.stringify(validPayload));

		expect(response.status).toBe(204);
		expect(error).toHaveBeenCalledTimes(1);
		expect(error).toHaveBeenCalledWith(expectedLog);
	});

	it('accepts a same-origin request without Origin and a charset parameter', async () => {
		const response = await post(
			JSON.stringify({
				...validPayload,
				type: 'stylesheet-not-applied',
				pathname: '/',
				stylesheetPath: undefined
			}),
			{ 'content-type': 'application/json; charset=utf-8' }
		);

		expect(response.status).toBe(204);
		expect(error).toHaveBeenCalledWith({
			message: 'client-css-diagnostic',
			diagnostic: expect.objectContaining({
				type: 'stylesheet-not-applied',
				pathname: '/',
				stylesheets: expect.not.objectContaining({ failed: expect.anything() }),
				client: expect.not.objectContaining({ userAgent: expect.anything() })
			})
		});
	});

	it('accepts unavailable response statuses', async () => {
		const response = await post(
			JSON.stringify({ ...validPayload, stylesheetResponseStatuses: [null, 0] })
		);

		expect(response.status).toBe(204);
		expect(error).toHaveBeenCalledWith({
			message: 'client-css-diagnostic',
			diagnostic: expect.objectContaining({
				stylesheets: expect.objectContaining({
					resources: [
						{ path: '/_app/immutable/assets/0.Bx3k2Lm.css', responseStatus: null },
						{ path: '/_app/immutable/assets/2.C9dE.css', responseStatus: 0 }
					]
				})
			})
		});
	});

	it('does not log fields that are not allowed', async () => {
		await post(
			JSON.stringify({
				...validPayload,
				message: 'injected',
				content: 'hello',
				npub: 'npub1injected',
				diagnostic: { type: 'injected' },
				stylesheets: { injected: true },
				client: { userAgent: 'injected' },
				server: { gitSha: 'injected' }
			})
		);

		expect(error).toHaveBeenCalledTimes(1);
		expect(error).toHaveBeenCalledWith(expectedLog);
	});

	it.each([
		['an unknown type', { ...validPayload, type: 'script-load-error' }],
		['a pathname with a Nostr identifier', { ...validPayload, pathname: '/npub1abcdefgh' }],
		['a pathname with a query', { ...validPayload, pathname: '/search?q=nostr' }],
		['a too long pathname', { ...validPayload, pathname: `/${'a/'.repeat(128)}` }],
		['a too long stylesheet path', { ...validPayload, stylesheetPath: `/${'a'.repeat(256)}` }],
		['a stylesheet URL', { ...validPayload, stylesheetPath: 'https://nostter.app/app.css' }],
		[
			'a stylesheet path with a query',
			{ ...validPayload, stylesheetPath: '/_app/example.css?value=secret' }
		],
		[
			'a stylesheet path with a hash',
			{ ...validPayload, stylesheetPath: '/_app/example.css#fragment' }
		],
		[
			'stylesheet paths with a query',
			{ ...validPayload, stylesheetPaths: ['/_app/example.css?value=secret'] }
		],
		[
			'unavailable stylesheet paths with a hash',
			{ ...validPayload, unavailableStylesheetPaths: ['/_app/example.css#fragment'] }
		],
		['too many stylesheets', { ...validPayload, stylesheetPaths: Array(33).fill('/a.css') }],
		['missing response statuses', { ...validPayload, stylesheetResponseStatuses: undefined }],
		['a string response status', { ...validPayload, stylesheetResponseStatuses: ['503', 200] }],
		[
			'a non-integer response status',
			{ ...validPayload, stylesheetResponseStatuses: [503.5, 200] }
		],
		['a negative response status', { ...validPayload, stylesheetResponseStatuses: [-1, 200] }],
		['too few response statuses', { ...validPayload, stylesheetResponseStatuses: [503] }],
		[
			'too many response statuses',
			{ ...validPayload, stylesheetResponseStatuses: [503, 200, 200] }
		],
		['a missing field', { ...validPayload, standalone: undefined }],
		['a non-integer timestamp', { ...validPayload, timestamp: 1.5 }],
		['a non-object payload', [validPayload]]
	])('rejects %s', async (_, payload) => {
		const response = await post(JSON.stringify(payload));

		expect(response.status).toBe(400);
		expect(error).not.toHaveBeenCalled();
	});

	it('rejects invalid JSON', async () => {
		const response = await post('{"type":');

		expect(response.status).toBe(400);
		expect(error).not.toHaveBeenCalled();
	});

	it('rejects a too large body', async () => {
		const response = await post(JSON.stringify({ ...validPayload, padding: 'a'.repeat(4096) }));

		expect(response.status).toBe(413);
		expect(error).not.toHaveBeenCalled();
	});

	it('rejects a non-JSON content type', async () => {
		const response = await post(JSON.stringify(validPayload), {
			'content-type': 'text/plain',
			origin: 'https://nostter.app'
		});

		expect(response.status).toBe(415);
		expect(error).not.toHaveBeenCalled();
	});

	it('rejects a cross-origin request', async () => {
		const response = await post(JSON.stringify(validPayload), {
			'content-type': 'application/json',
			origin: 'https://example.com'
		});

		expect(response.status).toBe(403);
		expect(error).not.toHaveBeenCalled();
	});
});
