import { describe, expect, it, vi } from 'vitest';
import type { Event } from 'nostr-tools';
import {
	Blossom,
	createBlossomAuthorizationTemplate,
	getBlossomUploadAction,
	resolveBlossomServer
} from './Blossom';

const { signEvent } = vi.hoisted(() => ({
	signEvent: vi.fn(async (template) => ({
		...template,
		id: 'id',
		pubkey: 'pubkey',
		sig: 'sig'
	}))
}));

vi.mock('$lib/Signer', () => ({ Signer: { signEvent } }));

const serverList = (tags: string[][]): Event =>
	({ kind: 10063, tags, content: '', created_at: 0, id: '', pubkey: '', sig: '' }) as Event;

describe('resolveBlossomServer', () => {
	it('uses the first valid HTTPS server in tag order', () => {
		const event = serverList([
			['server', 'not a url'],
			['server', 'http://insecure.example'],
			['server', 'https://first.example/path'],
			['server', 'https://second.example']
		]);
		expect(resolveBlossomServer(event).href).toBe('https://first.example/path');
	});

	it('falls back when no valid HTTPS server exists', () => {
		expect(resolveBlossomServer(serverList([['server', 'http://insecure.example']])).href).toBe(
			'https://blossom.band/'
		);
		expect(resolveBlossomServer(undefined).href).toBe('https://blossom.band/');
	});
});

describe('Blossom authorization', () => {
	it('scopes a media token to the hash, expiration, and lowercase server hostname', () => {
		const template = createBlossomAuthorizationTemplate(
			'media',
			'abc123',
			new URL('https://CDN.Example:443/path'),
			1_000
		);
		expect(template.kind).toBe(24242);
		expect(template.tags).toEqual([
			['t', 'media'],
			['x', 'abc123'],
			['expiration', '1300'],
			['server', 'cdn.example']
		]);
	});

	it('uses upload for non-media files', () => {
		expect(getBlossomUploadAction('image/png')).toBe('media');
		expect(getBlossomUploadAction('video/mp4')).toBe('media');
		expect(getBlossomUploadAction('application/pdf')).toBe('upload');
	});

	it('uploads images directly to /media with BUD-11 authorization', async () => {
		const fetchMock = vi.fn<
			(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
		>(
			async () =>
				new Response(JSON.stringify({ url: 'https://cdn.example/hash.png' }), {
					status: 201
				})
		);
		vi.stubGlobal('fetch', fetchMock);
		const file = new File(['image'], 'image.png', { type: 'image/png' });

		await expect(
			new Blossom(new URL('https://upload.example/path')).upload(file)
		).resolves.toEqual(expect.objectContaining({ url: 'https://cdn.example/hash.png' }));

		const [url, options] = fetchMock.mock.calls[0]!;
		const headers = options!.headers as Record<string, string>;
		expect(String(url)).toBe('https://upload.example/media');
		expect(options!.method).toBe('PUT');
		expect(options!.body).toBe(file);
		expect(headers.Authorization).toMatch(/^Nostr [A-Za-z0-9_-]+$/);
		expect(headers.Authorization).not.toContain('=');
		expect(headers['X-SHA-256']).toMatch(/^[0-9a-f]{64}$/);
		expect(signEvent).toHaveBeenCalledWith(
			expect.objectContaining({
				kind: 24242,
				tags: expect.arrayContaining([
					['t', 'media'],
					['server', 'upload.example']
				])
			})
		);
	});
});
