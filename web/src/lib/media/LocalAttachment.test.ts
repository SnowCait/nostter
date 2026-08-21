import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	appendUrls,
	createLocalAttachments,
	revokeAttachments,
	uploadLocalAttachments,
	type LocalAttachment
} from './LocalAttachment';

const createObjectURL = vi.spyOn(URL, 'createObjectURL');
const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL');

afterEach(() => {
	createObjectURL.mockReset();
	revokeObjectURL.mockReset();
});

describe('local attachments', () => {
	it('creates image, video, and audio previews without uploading', () => {
		createObjectURL.mockImplementation((file) => `blob:${(file as File).name}`);
		const files = [
			new File([], 'image.png', { type: 'image/png' }),
			new File([], 'video.mp4', { type: 'video/mp4' }),
			new File([], 'audio.mp3', { type: 'audio/mpeg' })
		];
		const attachments = createLocalAttachments(files);

		expect(
			attachments.map(({ kind, state, previewUrl }) => ({ kind, state, previewUrl }))
		).toEqual([
			{ kind: 'image', state: 'pending', previewUrl: 'blob:image.png' },
			{ kind: 'video', state: 'pending', previewUrl: 'blob:video.mp4' },
			{ kind: 'audio', state: 'pending', previewUrl: 'blob:audio.mp3' }
		]);
	});

	it('falls back to known media file extensions when the MIME type is empty', () => {
		createObjectURL.mockImplementation((file) => `blob:${(file as File).name}`);
		const attachments = createLocalAttachments([
			new File([], 'image.JPG'),
			new File([], 'video.webm'),
			new File([], 'audio.opus'),
			new File([], 'unknown.bin')
		]);

		expect(attachments.map(({ file, kind }) => ({ name: file.name, kind }))).toEqual([
			{ name: 'image.JPG', kind: 'image' },
			{ name: 'video.webm', kind: 'video' },
			{ name: 'audio.opus', kind: 'audio' }
		]);
	});

	it('preserves URL order when appending to content', () => {
		expect(appendUrls('hello', ['https://one', 'https://two'])).toBe(
			'hello\nhttps://one\nhttps://two'
		);
		expect(appendUrls('', ['https://one'])).toBe('https://one');
	});

	it('keeps partial success and retries only the failed attachment', async () => {
		const first = attachment('first.png');
		const second = attachment('second.png');
		const upload = vi
			.fn()
			.mockResolvedValueOnce([
				{ file: first.file, url: 'https://media/first.png' },
				{ file: second.file, url: undefined }
			])
			.mockResolvedValueOnce([{ file: second.file, url: 'https://media/second.png' }]);

		expect(await uploadLocalAttachments([first, second], upload)).toBeUndefined();
		expect([first.state, second.state]).toEqual(['uploaded', 'failed']);
		expect(await uploadLocalAttachments([first, second], upload)).toEqual([
			'https://media/first.png',
			'https://media/second.png'
		]);
		expect(upload.mock.calls[1][0]).toEqual([second.file]);
		expect([first.url, second.url]).toEqual([
			'https://media/first.png',
			'https://media/second.png'
		]);
	});

	it('returns an empty URL list when there are no attachments', async () => {
		expect(await uploadLocalAttachments([], vi.fn())).toEqual([]);
	});

	it('does not accept an uploaded attachment without a URL', async () => {
		const inconsistent = attachment('inconsistent.png');
		inconsistent.state = 'uploaded';
		expect(await uploadLocalAttachments([inconsistent], vi.fn())).toBeUndefined();
	});

	it('revokes object URLs when attachments are discarded', () => {
		const attachments = [attachment('first.png'), attachment('second.png')];
		revokeAttachments(attachments);
		expect(revokeObjectURL.mock.calls).toEqual([['blob:first.png'], ['blob:second.png']]);
	});

	it('leaves no attachment uploading when the uploader rejects', async () => {
		const attachments = [attachment('first.png'), attachment('second.png')];
		expect(
			await uploadLocalAttachments(attachments, vi.fn().mockRejectedValue('offline'))
		).toBeUndefined();
		expect(attachments.map(({ state }) => state)).toEqual(['failed', 'failed']);
	});
});

function attachment(name: string): LocalAttachment {
	return {
		file: new File([], name, { type: 'image/png' }),
		previewUrl: `blob:${name}`,
		kind: 'image',
		state: 'pending'
	};
}
