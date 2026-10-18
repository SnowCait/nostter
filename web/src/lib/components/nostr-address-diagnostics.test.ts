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
	return diagnoseNostrAddress(query, pubkey, new AbortController().signal);
}

describe('Nostr Address diagnostics', () => {
	it('checks an exact name and a valid public key with one non-following request', async () => {
		const signal = new AbortController().signal;
		const fetchMock = vi.fn().mockResolvedValue(Response.json({ names: { alice: pubkey } }));
		vi.stubGlobal('fetch', fetchMock);
		const addressQuery = getNostrAddressQuery('alice@example.com');
		expect(addressQuery).toBeDefined();
		expect(await diagnoseNostrAddress(addressQuery!, pubkey, signal)).toEqual({
			status: 'success'
		});
		expect(fetchMock).toHaveBeenCalledExactlyOnceWith(query.url, {
			redirect: 'manual',
			signal
		});
	});

	it('classifies opaque redirects without following them', async () => {
		const response = Response.error();
		Object.defineProperty(response, 'type', { value: 'opaqueredirect' });
		expect(await diagnose(response)).toEqual({ status: 'redirect' });
		expect(fetch).toHaveBeenCalledTimes(1);
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

	it('distinguishes missing names, invalid public keys, and public key mismatches', async () => {
		expect(await diagnose(Response.json({ names: { Alice: pubkey } }))).toEqual({
			status: 'nameNotFound'
		});
		expect(await diagnose(Response.json({ names: { alice: 'invalid-pubkey' } }))).toEqual({
			status: 'pubkeyError'
		});
		expect(await diagnose(Response.json({ names: { alice: 'b'.repeat(64) } }))).toEqual({
			status: 'pubkeyMismatch'
		});
	});

	it('does not claim to distinguish CORS from network failures', async () => {
		expect(await diagnose(Response.error())).toEqual({ status: 'networkError' });
		expect(await diagnose(new TypeError('Failed to fetch'))).toEqual({
			status: 'networkError'
		});
	});
});
