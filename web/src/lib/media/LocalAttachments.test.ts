import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { uploadFiles } = vi.hoisted(() => ({ uploadFiles: vi.fn() }));

vi.mock('./Uploader', () => ({ uploadFiles }));

import { LocalAttachments } from './LocalAttachments.svelte';

const createObjectURL = vi.spyOn(URL, 'createObjectURL');
const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL');

beforeEach(() => {
	createObjectURL.mockImplementation((file) => `blob:${(file as File).name}`);
});

afterEach(() => {
	uploadFiles.mockReset();
	createObjectURL.mockReset();
	revokeObjectURL.mockReset();
});

describe('LocalAttachments', () => {
	it('reports whether attachments exist', () => {
		const localAttachments = new LocalAttachments();
		expect(localAttachments.hasAttachments).toBe(false);

		localAttachments.add([new File([], 'first.png', { type: 'image/png' })]);
		expect(localAttachments.hasAttachments).toBe(true);

		localAttachments.remove(localAttachments.attachments[0]);
		expect(localAttachments.hasAttachments).toBe(false);

		localAttachments.add([new File([], 'second.png', { type: 'image/png' })]);
		localAttachments.clear();
		expect(localAttachments.hasAttachments).toBe(false);
	});

	it('adds supported media without uploading', () => {
		const localAttachments = new LocalAttachments();
		localAttachments.add([
			new File([], 'image.png', { type: 'image/png' }),
			new File([], 'video.mp4', { type: 'video/mp4' }),
			new File([], 'unknown.txt', { type: 'text/plain' })
		]);

		expect(
			localAttachments.attachments.map(({ file, kind, state, previewUrl }) => ({
				name: file.name,
				kind,
				state,
				previewUrl
			}))
		).toEqual([
			{ name: 'image.png', kind: 'image', state: 'pending', previewUrl: 'blob:image.png' },
			{ name: 'video.mp4', kind: 'video', state: 'pending', previewUrl: 'blob:video.mp4' }
		]);
		expect(uploadFiles).not.toHaveBeenCalled();
	});

	it('revokes the preview URL before removing an attachment', () => {
		const localAttachments = new LocalAttachments();
		localAttachments.add([
			new File([], 'first.png', { type: 'image/png' }),
			new File([], 'second.png', { type: 'image/png' })
		]);

		localAttachments.remove(localAttachments.attachments[0]);

		expect(revokeObjectURL).toHaveBeenCalledWith('blob:first.png');
		expect(localAttachments.attachments.map(({ file }) => file.name)).toEqual(['second.png']);
	});

	it('revokes all preview URLs and empties the collection when cleared', () => {
		const localAttachments = new LocalAttachments();
		localAttachments.add([
			new File([], 'first.png', { type: 'image/png' }),
			new File([], 'second.png', { type: 'image/png' })
		]);

		localAttachments.clear();

		expect(revokeObjectURL.mock.calls).toEqual([['blob:first.png'], ['blob:second.png']]);
		expect(localAttachments.attachments).toEqual([]);
	});

	it('uploads a collection snapshot and reacts to in-place upload state changes', async () => {
		const localAttachments = new LocalAttachments();
		const first = new File([], 'first.png', { type: 'image/png' });
		localAttachments.add([first]);
		let finishUpload: (results: { file: File; url: string | undefined }[]) => void = () => {};
		uploadFiles.mockImplementation(
			() =>
				new Promise((resolve) => {
					finishUpload = resolve;
				})
		);

		const uploading = localAttachments.upload();
		expect(localAttachments.uploading).toBe(true);
		localAttachments.add([new File([], 'second.png', { type: 'image/png' })]);
		finishUpload([{ file: first, url: 'https://media/first.png' }]);

		expect(await uploading).toEqual(['https://media/first.png']);
		expect(localAttachments.uploading).toBe(false);
		expect(uploadFiles).toHaveBeenCalledWith([first]);
		expect(localAttachments.attachments.map(({ state }) => state)).toEqual([
			'uploaded',
			'pending'
		]);
	});

	it('keeps failed uploads retryable', async () => {
		const localAttachments = new LocalAttachments();
		const file = new File([], 'image.png', { type: 'image/png' });
		localAttachments.add([file]);
		uploadFiles
			.mockResolvedValueOnce([{ file, url: undefined }])
			.mockResolvedValueOnce([{ file, url: 'https://media/image.png' }]);

		expect(await localAttachments.upload()).toBeUndefined();
		expect(localAttachments.attachments[0].state).toBe('failed');
		await localAttachments.retry(localAttachments.attachments[0]);

		expect(localAttachments.attachments[0]).toMatchObject({
			state: 'uploaded',
			url: 'https://media/image.png'
		});
		expect(uploadFiles).toHaveBeenCalledTimes(2);
	});

	it('revokes remaining preview URLs on dispose without double-revoking cleared entries', () => {
		const localAttachments = new LocalAttachments();
		localAttachments.add([new File([], 'image.png', { type: 'image/png' })]);

		localAttachments.dispose();
		localAttachments.dispose();

		expect(revokeObjectURL).toHaveBeenCalledOnce();
		expect(revokeObjectURL).toHaveBeenCalledWith('blob:image.png');
		expect(localAttachments.attachments).toEqual([]);
	});
});
