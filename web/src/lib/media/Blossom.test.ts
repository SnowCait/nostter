import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Event } from 'nostr-tools';

const { uploadBlob, uploadMedia, createUploadAuth, signEvent } = vi.hoisted(() => ({
	uploadBlob: vi.fn(),
	uploadMedia: vi.fn(),
	createUploadAuth: vi.fn(),
	signEvent: vi.fn(async (template) => ({
		...template,
		id: 'id',
		pubkey: 'pubkey',
		sig: 'sig'
	}))
}));

vi.mock('blossom-client-sdk', async (importOriginal) => ({
	...(await importOriginal<typeof import('blossom-client-sdk')>()),
	Actions: { uploadBlob, uploadMedia },
	createUploadAuth
}));
vi.mock('$lib/Signer', () => ({ Signer: { signEvent } }));

import { Blossom, resolveBlossomServer } from './Blossom';

const descriptor = {
	uploaded: 0,
	type: 'image/png',
	sha256: 'abc123',
	size: 5,
	url: 'https://cdn.example/abc123.png'
};
const serverList = (tags: string[][]): Event =>
	({ kind: 10063, tags, content: '', created_at: 0, id: '', pubkey: '', sig: '' }) as Event;

describe('resolveBlossomServer', () => {
	it('uses SDK parsing and selects the first HTTPS server in tag order', () => {
		const event = serverList([
			['server', 'not a url'],
			['server', 'http://insecure.example'],
			['server', 'https://first.example/path'],
			['server', 'https://second.example']
		]);
		expect(resolveBlossomServer(event).href).toBe('https://first.example/');
	});

	it('falls back when the SDK-parsed list has no HTTPS server', () => {
		expect(resolveBlossomServer(serverList([['server', 'http://insecure.example']])).href).toBe(
			'https://blossom.band/'
		);
		expect(resolveBlossomServer(undefined).href).toBe('https://blossom.band/');
	});
});

describe('Blossom SDK adapter', () => {
	afterEach(() => vi.useRealTimers());

	beforeEach(() => {
		uploadBlob.mockReset().mockResolvedValue(descriptor);
		uploadMedia.mockReset().mockResolvedValue(descriptor);
		createUploadAuth.mockReset().mockImplementation(async (signer, _sha256, options) =>
			signer({
				kind: 24242,
				content: '',
				created_at: Math.floor(Date.now() / 1000),
				tags: [
					['t', options.type],
					['x', 'abc123'],
					['expiration', String(options.expiration)],
					['server', 'upload.example']
				]
			})
		);
		signEvent.mockClear();
	});

	it.each([
		['image', 'image/png'],
		['video', 'video/mp4']
	])('uses uploadMedia for an %s', async (_name, type) => {
		const file = new File(['media'], 'media', { type });
		const blossom = new Blossom(new URL('https://upload.example/path'));
		await expect(blossom.upload(file)).resolves.toEqual({
			url: descriptor.url,
			data: descriptor
		});
		expect(uploadMedia).toHaveBeenCalledWith(
			new URL('https://upload.example/path'),
			file,
			expect.objectContaining({ onAuth: expect.any(Function) })
		);
		expect(uploadBlob).not.toHaveBeenCalled();
	});

	it('uses uploadBlob for other files', async () => {
		const file = new File(['document'], 'document.pdf', { type: 'application/pdf' });
		await new Blossom(new URL('https://upload.example')).upload(file);
		expect(uploadBlob).toHaveBeenCalledWith(
			new URL('https://upload.example'),
			file,
			expect.objectContaining({ onAuth: expect.any(Function) })
		);
		expect(uploadMedia).not.toHaveBeenCalled();
	});

	it('connects the nostter signer through the SDK auth callback', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-08-15T00:00:00Z'));
		const file = new File(['document'], 'document.pdf', { type: 'application/pdf' });
		uploadBlob.mockImplementation(async (server, _file, options) => {
			await options.onAuth(server, 'abc123', 'upload', file);
			return descriptor;
		});

		await new Blossom(new URL('https://upload.example')).upload(file);

		expect(createUploadAuth).toHaveBeenCalledWith(expect.any(Function), 'abc123', {
			type: 'upload',
			servers: 'https://upload.example/',
			expiration: 1_786_752_300
		});
		expect(signEvent).toHaveBeenCalledWith(expect.objectContaining({ kind: 24242 }));
	});
});
