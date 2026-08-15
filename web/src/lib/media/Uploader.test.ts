import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccountLocalPreferences } from '$lib/preferences/AccountLocalPreferences';

const { preferences, blossomConstructor, fileStorageConstructor } = vi.hoisted(() => ({
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
	fileStorageConstructor: vi.fn()
}));

vi.mock('$lib/preferences/AccountLocalPreferences', () => ({
	getAccountLocalPreferences: () => preferences
}));
vi.mock('./Blossom', () => ({
	defaultBlossomServerUrl: 'https://blossom.band',
	Blossom: class {
		constructor(server: URL) {
			blossomConstructor(server);
		}
	}
}));
vi.mock('./FileStorageServer', () => ({
	FileStorageServer: class {
		constructor(server: string) {
			fileStorageConstructor(server);
		}
	}
}));

import { getMediaUploader } from './Uploader';

describe('getMediaUploader', () => {
	beforeEach(() => {
		blossomConstructor.mockClear();
		fileStorageConstructor.mockClear();
	});

	it('uses the last persisted Blossom server immediately', () => {
		preferences.set({
			mediaUploader: { type: 'blossom', server: 'https://previous.example/path' }
		});
		getMediaUploader();
		expect(blossomConstructor).toHaveBeenCalledWith(new URL('https://previous.example/path'));
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
		expect(fileStorageConstructor).toHaveBeenCalledWith('https://nostr.build');
		expect(blossomConstructor).not.toHaveBeenCalled();
	});
});
