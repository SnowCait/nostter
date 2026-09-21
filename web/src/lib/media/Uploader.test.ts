import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccountLocalPreferences } from '$lib/preferences/AccountLocalPreferences';

const { preferences, blossomConstructor, fileStorageConstructor, signEvent, session } = vi.hoisted(
	() => ({
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
		session: { signer: undefined as { signEvent: () => Promise<unknown> } | undefined }
	})
);

vi.mock('$lib/preferences/AccountLocalPreferences', () => ({
	getAccountLocalPreferences: () => preferences
}));
vi.mock('./Blossom', () => ({
	Blossom: class {
		constructor(server: URL, signingCapability: unknown) {
			blossomConstructor(server, signingCapability);
		}
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

import { getMediaUploader } from './Uploader';

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
