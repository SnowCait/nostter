import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccountLocalPreferences } from '$lib/preferences/AccountLocalPreferences';

const { preferences, blossomConstructor, fileStorageConstructor, signEvent, session, upload } =
	vi.hoisted(() => ({
		preferences: (() => {
			let value: AccountLocalPreferences = {};
			return {
				subscribe(run: (current: AccountLocalPreferences) => void) {
					run(value);
					return () => undefined;
				},
				set(next: AccountLocalPreferences) {
					value = next;
				}
			};
		})(),
		blossomConstructor: vi.fn(),
		fileStorageConstructor: vi.fn(),
		signEvent: vi.fn(),
		upload: vi.fn(),
		session: { signer: undefined as { signEvent: () => Promise<unknown> } | undefined }
	}));

vi.mock('$lib/preferences/AccountLocalPreferences', () => ({
	getAccountLocalPreferences: () => preferences
}));
vi.mock('./Blossom', () => ({
	Blossom: class {
		constructor(server: URL, signingCapability: unknown) {
			blossomConstructor(server, signingCapability);
		}
		upload = upload;
	}
}));
vi.mock('$lib/Constants', () => ({
	defaultBlossomServerUrl: 'https://blossom.band'
}));
vi.mock('./FileStorageServer', () => ({
	FileStorageServer: class {
		constructor(server: string, signingCapability: unknown) {
			fileStorageConstructor(server, signingCapability);
		}
		upload = upload;
	}
}));
vi.mock('$lib/auth.svelte', () => ({
	auth: {
		pubkey: 'f'.repeat(64),
		get signer() {
			return session.signer;
		}
	}
}));

import { getMediaUploader, uploadFiles } from './Uploader';

describe('getMediaUploader', () => {
	beforeEach(() => {
		blossomConstructor.mockClear();
		fileStorageConstructor.mockClear();
		signEvent.mockClear();
		session.signer = { signEvent };
	});

	it('uses the last persisted Blossom server immediately', () => {
		preferences.set({
			mediaUploader: { type: 'blossom', server: 'https://previous.example/path' }
		});
		getMediaUploader();
		expect(blossomConstructor).toHaveBeenCalledWith(
			new URL('https://previous.example/path'),
			expect.any(Function)
		);
	});

	it('uses a changed persisted server on the next upload', () => {
		preferences.set({
			mediaUploader: { type: 'blossom', server: 'https://first.example' }
		});
		getMediaUploader();
		preferences.set({
			mediaUploader: { type: 'blossom', server: 'https://updated.example' }
		});
		getMediaUploader();
		expect(blossomConstructor.mock.calls.map(([server]) => server.href)).toEqual([
			'https://first.example/',
			'https://updated.example/'
		]);
	});

	it('keeps using the persisted NIP-96 selection', () => {
		preferences.set({
			mediaUploader: { type: 'nip96', server: 'https://nostr.build' }
		});
		getMediaUploader();
		expect(fileStorageConstructor).toHaveBeenCalledWith(
			'https://nostr.build',
			expect.any(Function)
		);
		expect(blossomConstructor).not.toHaveBeenCalled();
	});

	it('composes uploader signing from the authenticated session signer', async () => {
		preferences.set({
			mediaUploader: { type: 'blossom', server: 'https://upload.example' }
		});
		const template = { kind: 1, content: '', created_at: 1, tags: [] };
		getMediaUploader();

		const signingCapability = blossomConstructor.mock.calls[0][1] as (
			unsignedEvent: unknown
		) => Promise<unknown>;
		await signingCapability(template);

		expect(signEvent).toHaveBeenCalledWith(template);
	});

	it('rejects an authenticated session without a signer', () => {
		session.signer = undefined;

		expect(() => getMediaUploader()).toThrow('without a signing session');
	});
});

describe('upload filename privacy', () => {
	beforeEach(() => {
		session.signer = { signEvent };
		upload.mockReset();
		upload.mockResolvedValue({ url: 'https://media.example/file', data: {} });
	});
	it.each(['blossom', 'nip96'] as const)(
		'sanitizes files sent through %s, preserving bytes and MIME',
		async (type) => {
			preferences.set({ mediaUploader: { type, server: 'https://upload.example' } });
			for (const [mime, extension] of [
				['image/jpeg', 'jpg'],
				['image/png', 'png'],
				['image/apng', 'apng'],
				['image/bmp', 'bmp'],
				['audio/mpeg', 'mp3'],
				['audio/aac', 'aac'],
				['video/mp4', 'mp4'],
				['video/x-msvideo', 'avi'],
				['', 'bin'],
				['image/webp', 'webp'],
				['application/unknown', 'bin']
			]) {
				const original = new File([new Uint8Array([0, 17, 255])], 'Alice-private.png', {
					type: mime
				});
				await getMediaUploader().upload(original);
				const sent = upload.mock.lastCall![0] as File;
				expect(sent).toBeInstanceOf(File);
				expect(sent.name).toBe(`upload.${extension}`);
				expect(sent.type).toBe(mime);
				expect(new Uint8Array(await sent.arrayBuffer())).toEqual(
					new Uint8Array([0, 17, 255])
				);
			}
			await getMediaUploader().upload(new Blob(['crop'], { type: 'image/png' }));
			const cropped = upload.mock.lastCall![0] as File;
			expect(cropped).toBeInstanceOf(File);
			expect(cropped.name).toBe('upload.png');
			expect(cropped.type).toBe('image/png');
			expect(await cropped.text()).toBe('crop');
		}
	);
	it('returns the original attachment reference and supports retry after failure', async () => {
		preferences.set({ mediaUploader: { type: 'blossom', server: 'https://upload.example' } });
		const file = new File(['x'], 'Alice.png', { type: 'image/png' });
		upload.mockRejectedValueOnce(new Error('offline'));
		expect(await uploadFiles([file])).toEqual([{ file, url: undefined }]);
		expect(await uploadFiles([file])).toEqual([{ file, url: 'https://media.example/file' }]);
		expect(upload.mock.calls.map(([sent]) => sent.name)).toEqual(['upload.png', 'upload.png']);
	});
});
