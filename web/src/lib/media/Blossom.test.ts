import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

vi.mock(import('blossom-client-sdk/actions/upload'), () => ({ uploadBlob }));
vi.mock(import('blossom-client-sdk/actions/media'), () => ({ uploadMedia }));
vi.mock(import('blossom-client-sdk/auth'), () => ({ createUploadAuth }));
vi.mock('$lib/Signer', () => ({ Signer: { signEvent } }));

import { Blossom } from './Blossom';

const descriptor = {
	uploaded: 0,
	type: 'image/png',
	sha256: 'abc123',
	size: 5,
	url: 'https://cdn.example/abc123.png'
};
describe('Blossom SDK adapter', () => {
	afterEach(() => vi.useRealTimers());

	beforeEach(() => {
		uploadBlob.mockReset().mockResolvedValue(descriptor);
		uploadMedia.mockReset().mockResolvedValue(descriptor);
		createUploadAuth.mockReset().mockResolvedValue({ auth: true });
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
		await new Blossom(new URL('https://upload.example')).upload(file);
		const onAuth = uploadBlob.mock.calls[0][2].onAuth;
		await onAuth(new URL('https://upload.example'), 'abc123', 'upload', file);

		expect(createUploadAuth).toHaveBeenCalledWith(expect.any(Function), 'abc123', {
			type: 'upload',
			servers: 'https://upload.example/',
			expiration: 1_786_752_300
		});

		const sdkSigner = createUploadAuth.mock.calls[0][0];
		const template = { kind: 1, content: 'test', created_at: 123, tags: [] };
		await sdkSigner(template);
		expect(signEvent).toHaveBeenCalledWith(template);
	});
});
