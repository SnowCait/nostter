import { afterEach, describe, expect, it, vi } from 'vitest';
import { createListContentDecrypter, getListTitle } from './List';

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
});
