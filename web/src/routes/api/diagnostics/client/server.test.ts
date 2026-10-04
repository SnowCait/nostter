import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './+server';

const clientGitSha = '0123456789abcdef0123456789abcdef01234567';
const serverGitSha = 'fedcba9876543210fedcba9876543210fedcba98';

vi.mock('$lib/build', () => ({ gitSha: 'fedcba9876543210fedcba9876543210fedcba98' }));

type Event = Parameters<typeof POST>[0];

const endpoint = 'https://nostter.app/api/diagnostics/client';

const validPayload = {
	type: 'stylesheet-load-error',
	pathname: '/[npub]/lists',
	stylesheetPath: '/_app/immutable/assets/0.Bx3k2Lm.css',
	stylesheetPaths: ['/_app/immutable/assets/0.Bx3k2Lm.css', '/_app/immutable/assets/2.C9dE.css'],
	stylesheetResponseStatuses: [503, 200],
	unavailableStylesheetPaths: ['/_app/immutable/assets/0.Bx3k2Lm.css'],
	javascriptResources: [
		{
			path: '/_app/immutable/entry/start.D4kQ.js',
			initiatorType: 'link',
			responseStatus: 503
		},
		{ path: '/_app/immutable/chunks/Cx9a-b_1.js', initiatorType: 'script', responseStatus: 200 }
	],
	timestamp: 1790000000000,
	standalone: true,
	serviceWorkerControlled: false,
	gitSha: clientGitSha
};

const javascriptResource = (overrides: Record<string, unknown> = {}) => ({
	path: '/_app/immutable/entry/app.js',
	initiatorType: 'script',
	responseStatus: 200,
	...overrides
});

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
		javascript: {
			resources: [
				{
					path: '/_app/immutable/entry/start.D4kQ.js',
					initiatorType: 'link',
					responseStatus: 503
				},
				{
					path: '/_app/immutable/chunks/Cx9a-b_1.js',
					initiatorType: 'script',
					responseStatus: 200
				}
			]
		},
		client: {
			standalone: true,
			serviceWorkerControlled: false,
			gitSha: clientGitSha,
			userAgent: 'Mozilla/5.0'
		},
		server: {
			gitSha: serverGitSha
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

	it('logs a null client Git SHA when it is missing', async () => {
		const response = await post(JSON.stringify({ ...validPayload, gitSha: undefined }));

		expect(response.status).toBe(204);
		expect(error).toHaveBeenCalledWith({
			...expectedLog,
			diagnostic: {
				...expectedLog.diagnostic,
				client: { ...expectedLog.diagnostic.client, gitSha: null }
			}
		});
	});

	it('accepts a same-origin request without Origin and a charset parameter', async () => {
		const response = await post(
			JSON.stringify({
				...validPayload,
				type: 'stylesheet-not-applied',
				trigger: 'visibilitychange',
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
				trigger: 'visibilitychange',
				pathname: '/',
				stylesheets: expect.not.objectContaining({ failed: expect.anything() }),
				client: expect.not.objectContaining({ userAgent: expect.anything() })
			})
		});
	});

	it('accepts unavailable response statuses', async () => {
		const response = await post(
			JSON.stringify({
				...validPayload,
				stylesheetResponseStatuses: [null, 0],
				javascriptResources: [
					{
						path: '/_app/immutable/entry/app.js',
						initiatorType: 'link',
						responseStatus: 0
					},
					{
						path: '/_app/immutable/nodes/0.js',
						initiatorType: 'early-hints',
						responseStatus: null
					}
				]
			})
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
				}),
				javascript: {
					resources: [
						{
							path: '/_app/immutable/entry/app.js',
							initiatorType: 'link',
							responseStatus: 0
						},
						{
							path: '/_app/immutable/nodes/0.js',
							initiatorType: 'early-hints',
							responseStatus: null
						}
					]
				}
			})
		});
	});

	it('accepts up to 16 JavaScript resources', async () => {
		const javascriptResources = Array.from({ length: 16 }, (_, i) => ({
			path: `/_app/immutable/chunks/${i}.js`,
			initiatorType: 'link',
			responseStatus: 200
		}));

		const response = await post(JSON.stringify({ ...validPayload, javascriptResources }));

		expect(response.status).toBe(204);
		expect(error).toHaveBeenCalledWith({
			message: 'client-css-diagnostic',
			diagnostic: expect.objectContaining({ javascript: { resources: javascriptResources } })
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
				javascript: { injected: true },
				javascriptResources: validPayload.javascriptResources.map((resource) => ({
					...resource,
					injected: true
				})),
				client: { userAgent: 'injected' },
				server: { gitSha: 'injected' }
			})
		);

		expect(error).toHaveBeenCalledTimes(1);
		expect(error).toHaveBeenCalledWith(expectedLog);
	});

	it.each([
		['an unknown type', { ...validPayload, type: 'script-load-error' }],
		['a stylesheet load error with a trigger', { ...validPayload, trigger: 'load' }],
		[
			'stylesheet-not-applied without a trigger',
			{ ...validPayload, type: 'stylesheet-not-applied' }
		],
		[
			'stylesheet-not-applied with an unknown trigger',
			{ ...validPayload, type: 'stylesheet-not-applied', trigger: 'pageshow' }
		],
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
		['missing JavaScript resources', { ...validPayload, javascriptResources: undefined }],
		['non-array JavaScript resources', { ...validPayload, javascriptResources: {} }],
		[
			'too many JavaScript resources',
			{ ...validPayload, javascriptResources: Array(17).fill(javascriptResource()) }
		],
		['a non-object JavaScript resource', { ...validPayload, javascriptResources: ['/a.js'] }],
		[
			'a JavaScript path outside immutable assets',
			{
				...validPayload,
				javascriptResources: [javascriptResource({ path: '/_app/version.js' })]
			}
		],
		[
			'a non-JavaScript path',
			{
				...validPayload,
				javascriptResources: [javascriptResource({ path: '/_app/immutable/assets/0.css' })]
			}
		],
		[
			'a JavaScript URL',
			{
				...validPayload,
				javascriptResources: [
					javascriptResource({ path: 'https://nostter.app/_app/immutable/entry/app.js' })
				]
			}
		],
		[
			'a JavaScript path with a query',
			{
				...validPayload,
				javascriptResources: [
					javascriptResource({ path: '/_app/immutable/entry/app.js?value=secret' })
				]
			}
		],
		[
			'a too long JavaScript path',
			{
				...validPayload,
				javascriptResources: [
					javascriptResource({ path: `/_app/immutable/${'a'.repeat(238)}.js` })
				]
			}
		],
		[
			'a missing initiator type',
			{
				...validPayload,
				javascriptResources: [javascriptResource({ initiatorType: undefined })]
			}
		],
		[
			'an empty initiator type',
			{ ...validPayload, javascriptResources: [javascriptResource({ initiatorType: '' })] }
		],
		[
			'an initiator type with invalid characters',
			{
				...validPayload,
				javascriptResources: [javascriptResource({ initiatorType: 'Script<' })]
			}
		],
		[
			'a too long initiator type',
			{
				...validPayload,
				javascriptResources: [javascriptResource({ initiatorType: 'a'.repeat(33) })]
			}
		],
		[
			'a string JavaScript response status',
			{ ...validPayload, javascriptResources: [javascriptResource({ responseStatus: '0' })] }
		],
		[
			'a missing JavaScript response status',
			{
				...validPayload,
				javascriptResources: [javascriptResource({ responseStatus: undefined })]
			}
		],
		['an empty Git SHA', { ...validPayload, gitSha: '' }],
		['a null Git SHA', { ...validPayload, gitSha: null }],
		['a non-string Git SHA', { ...validPayload, gitSha: 1234567 }],
		['an abbreviated Git SHA', { ...validPayload, gitSha: clientGitSha.slice(0, 7) }],
		['an uppercase Git SHA', { ...validPayload, gitSha: clientGitSha.toUpperCase() }],
		['a too long Git SHA', { ...validPayload, gitSha: clientGitSha.repeat(2) }],
		['an arbitrary Git SHA', { ...validPayload, gitSha: 'main' }],
		['a Git SHA with whitespace', { ...validPayload, gitSha: ` ${clientGitSha}` }],
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

	it('accepts a body up to 8192 bytes', async () => {
		const body = JSON.stringify({ ...validPayload, padding: '' });
		const response = await post(
			JSON.stringify({ ...validPayload, padding: 'a'.repeat(8192 - body.length) })
		);

		expect(response.status).toBe(204);
	});

	it('rejects a too large body', async () => {
		const body = JSON.stringify({ ...validPayload, padding: '' });
		const response = await post(
			JSON.stringify({ ...validPayload, padding: 'a'.repeat(8193 - body.length) })
		);

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
