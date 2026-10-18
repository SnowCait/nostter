import { afterEach, describe, expect, it, vi } from 'vitest';
import { diagnoseNostrAddress, getNostrAddressQuery } from './nostr-address-diagnostics';

const pubkey = 'a'.repeat(64);
const query = { url: 'https://example.com/.well-known/nostr.json?name=alice', name: 'alice' };

afterEach(() => vi.unstubAllGlobals());

function diagnose(response: Response | Error) {
	const fetchMock = vi.fn();
	if (response instanceof Error) {
		fetchMock.mockRejectedValue(response);
	} else {
		fetchMock.mockResolvedValue(response);
	}
	vi.stubGlobal('fetch', fetchMock);
	return diagnoseNostrAddress(query, new AbortController().signal);
}

describe('Nostr Address diagnostics', () => {
	it('uses the default name for a domain-only address and rejects invalid identifiers', () => {
		expect(getNostrAddressQuery('example.com')).toEqual({
			url: 'https://example.com/.well-known/nostr.json?name=_',
			name: '_'
		});
		expect(getNostrAddressQuery('not an address')).toBeUndefined();
	});

	it('checks an exact name and a valid public key with one non-following request', async () => {
		const signal = new AbortController().signal;
		const fetchMock = vi.fn().mockResolvedValue(Response.json({ names: { alice: pubkey } }));
		vi.stubGlobal('fetch', fetchMock);
		expect(await diagnoseNostrAddress(query, signal)).toEqual({ status: 'success' });
		expect(fetchMock).toHaveBeenCalledExactlyOnceWith(query.url, {
			redirect: 'manual',
			signal
		});
	});

	it('reports HTTP errors separately from invalid JSON', async () => {
		expect(await diagnose(new Response('Unavailable', { status: 503 }))).toEqual({
			status: 'httpError',
			code: 503
		});
		expect(await diagnose(new Response('not JSON'))).toEqual({ status: 'jsonError' });
	});

	it.each([null, {}, { names: null }, { names: [] }, { names: 'alice' }])(
		'rejects an invalid names structure: %j',
		async (json) => {
			expect(await diagnose(Response.json(json))).toEqual({ status: 'responseError' });
		}
	);

	it('distinguishes a missing exact name from an invalid public key', async () => {
		expect(await diagnose(Response.json({ names: { Alice: pubkey } }))).toEqual({
			status: 'nameNotFound'
		});
		expect(await diagnose(Response.json({ names: { alice: 'invalid-pubkey' } }))).toEqual({
			status: 'pubkeyError'
		});
	});

	it('does not claim to distinguish CORS from network failures', async () => {
		expect(await diagnose(new TypeError('Failed to fetch'))).toEqual({
			status: 'networkError'
		});
	});
});
