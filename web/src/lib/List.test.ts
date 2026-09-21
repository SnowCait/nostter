import { afterEach, describe, expect, it, vi } from 'vitest';
import { createListContentDecrypter, decryptListContent, getListTitle } from './List';
import { Signer } from './Signer';

describe('list', () => {
	it('title', () => {
		expect(
			getListTitle([
				['d', 'list1'],
				['title', 'title1']
			])
		).toStrictEqual('title1');
	});
	it('alt title', () => {
		expect(getListTitle([['d', 'list1']])).toStrictEqual('list1');
	});
});

describe('createListContentDecrypter', () => {
	afterEach(() => vi.restoreAllMocks());

	it('is unavailable without NIP-04 or NIP-44 capabilities', () => {
		expect(createListContentDecrypter({})).toBeUndefined();
	});

	it('decrypts current list content with a NIP-44-only capability', async () => {
		const nip44 = {
			encrypt: vi.fn(),
			decrypt: vi.fn().mockResolvedValue(JSON.stringify([['p', 'private']]))
		};
		const decrypter = createListContentDecrypter({ nip44 });

		await expect(decrypter?.('author', 'nip44-content')).resolves.toEqual([
			[['p', 'private']],
			false
		]);
		expect(nip44.decrypt).toHaveBeenCalledWith('author', 'nip44-content');
	});

	it('decrypts legacy list content with a NIP-04-only capability', async () => {
		const nip04 = {
			encrypt: vi.fn(),
			decrypt: vi.fn().mockResolvedValue(JSON.stringify([['p', 'private']]))
		};
		const decrypter = createListContentDecrypter({ nip04 });

		await expect(decrypter?.('author', 'legacy?iv=value')).resolves.toEqual([
			[['p', 'private']],
			true
		]);
		expect(nip04.decrypt).toHaveBeenCalledWith('author', 'legacy?iv=value');
	});

	it('silently omits private tags when the required capability is unavailable', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const nip04 = { encrypt: vi.fn(), decrypt: vi.fn() };
		const decrypter = createListContentDecrypter({ nip04 });

		await expect(decrypter?.('author', 'nip44-content')).resolves.toEqual([[], false]);
		expect(nip04.decrypt).not.toHaveBeenCalled();
		expect(warn).not.toHaveBeenCalled();
	});

	it('preserves the legacy format when the required capability is unavailable', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const nip44 = { encrypt: vi.fn(), decrypt: vi.fn() };
		const decrypter = createListContentDecrypter({ nip44 });

		await expect(decrypter?.('author', 'legacy?iv=value')).resolves.toEqual([[], true]);
		expect(nip44.decrypt).not.toHaveBeenCalled();
		expect(warn).not.toHaveBeenCalled();
	});

	it('reports a decrypt failure when the required capability exists', async () => {
		const error = new Error('permission denied');
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const nip44 = {
			encrypt: vi.fn(),
			decrypt: vi.fn().mockRejectedValue(error)
		};
		const decrypter = createListContentDecrypter({ nip44 });

		await expect(decrypter?.('author', 'nip44-content')).resolves.toEqual([[], false]);
		expect(warn).toHaveBeenCalledWith('[list parse error]', error);
	});

	it('preserves the legacy format when legacy decrypt fails', async () => {
		const error = new Error('permission denied');
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const nip04 = {
			encrypt: vi.fn(),
			decrypt: vi.fn().mockRejectedValue(error)
		};
		const decrypter = createListContentDecrypter({ nip04 });

		await expect(decrypter?.('author', 'legacy?iv=value')).resolves.toEqual([[], true]);
		expect(warn).toHaveBeenCalledWith('[list parse error]', error);
	});

	it('returns non-legacy for empty content', async () => {
		const nip44 = { encrypt: vi.fn(), decrypt: vi.fn() };
		const decrypter = createListContentDecrypter({ nip44 });

		await expect(decrypter?.('author', '')).resolves.toEqual([[], false]);
		expect(nip44.decrypt).not.toHaveBeenCalled();
	});
});

describe('decryptListContent', () => {
	afterEach(() => vi.restoreAllMocks());

	it('returns non-legacy for empty content', async () => {
		await expect(decryptListContent('author', '')).resolves.toEqual([[], false]);
	});

	it('preserves the legacy format without decryption capabilities', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		vi.spyOn(Signer, 'getEncryptionCapabilities').mockReturnValue({});

		await expect(decryptListContent('author', 'legacy?iv=value')).resolves.toEqual([[], true]);
		expect(warn).not.toHaveBeenCalled();
	});

	it('returns non-legacy without decryption capabilities for NIP-44 content', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		vi.spyOn(Signer, 'getEncryptionCapabilities').mockReturnValue({});

		await expect(decryptListContent('author', 'nip44-content')).resolves.toEqual([[], false]);
		expect(warn).not.toHaveBeenCalled();
	});

	it('preserves the legacy format without a signer', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		vi.spyOn(Signer, 'getEncryptionCapabilities').mockImplementation(() => {
			throw new Error('[logic error]');
		});

		await expect(decryptListContent('author', 'legacy?iv=value')).resolves.toEqual([[], true]);
	});
});
