import { afterEach, describe, expect, it, vi } from 'vitest';
import type * as Nostr from 'nostr-typedef';
import {
	createListContentDecrypter,
	createListContentEncrypter,
	decryptListContent,
	getListPubkeys,
	getListTitle
} from './List';
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

describe('getListPubkeys', () => {
	it('returns public tags', async () => {
		const event = {
			pubkey: 'author',
			content: '',
			tags: [['p', 'public']]
		} as Nostr.Event;

		await expect(getListPubkeys(event, undefined)).resolves.toEqual(['public']);
	});

	it('includes private tags for the current account when a decrypter is available', async () => {
		const event = {
			pubkey: 'account',
			content: 'private-content',
			tags: [['p', 'public']]
		} as Nostr.Event;
		const decrypter = vi.fn().mockResolvedValue([[['p', 'private']], false]);

		await expect(getListPubkeys(event, 'account', decrypter)).resolves.toEqual([
			'public',
			'private'
		]);
		expect(decrypter).toHaveBeenCalledWith('account', 'private-content');
	});

	it("does not decrypt another account's list", async () => {
		const event = {
			pubkey: 'author',
			content: 'private-content',
			tags: [['p', 'public']]
		} as Nostr.Event;
		const decrypter = vi.fn();

		await expect(getListPubkeys(event, 'account', decrypter)).resolves.toEqual(['public']);
		expect(decrypter).not.toHaveBeenCalled();
	});

	it('returns public tags when the current account has no decrypter', async () => {
		const event = {
			pubkey: 'account',
			content: 'private-content',
			tags: [['p', 'public']]
		} as Nostr.Event;

		await expect(getListPubkeys(event, 'account')).resolves.toEqual(['public']);
	});

	it('deduplicates public and private pubkeys', async () => {
		const event = {
			pubkey: 'account',
			content: 'private-content',
			tags: [['p', 'shared']]
		} as Nostr.Event;
		const decrypter = vi.fn().mockResolvedValue([
			[
				['p', 'shared'],
				['p', 'private']
			],
			false
		]);

		await expect(getListPubkeys(event, 'account', decrypter)).resolves.toEqual([
			'shared',
			'private'
		]);
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

describe('createListContentEncrypter', () => {
	it('encrypts current list content with a NIP-44-only capability', async () => {
		const nip44 = {
			encrypt: vi.fn().mockResolvedValue('nip44-content'),
			decrypt: vi.fn()
		};
		const encrypter = createListContentEncrypter({ nip44 });
		const tags = [['p', 'private']];

		await expect(encrypter('author', tags)).resolves.toBe('nip44-content');
		expect(nip44.encrypt).toHaveBeenCalledWith('author', JSON.stringify(tags));
	});

	it('encrypts legacy list content with a NIP-04-only capability', async () => {
		const nip04 = {
			encrypt: vi.fn().mockResolvedValue('legacy-content'),
			decrypt: vi.fn()
		};
		const encrypter = createListContentEncrypter({ nip04 });
		const tags = [['p', 'private']];

		await expect(encrypter('author', tags, true)).resolves.toBe('legacy-content');
		expect(nip04.encrypt).toHaveBeenCalledWith('author', JSON.stringify(tags));
	});

	it('returns empty content without encrypting empty tags', async () => {
		const nip04 = { encrypt: vi.fn(), decrypt: vi.fn() };
		const nip44 = { encrypt: vi.fn(), decrypt: vi.fn() };
		const encrypter = createListContentEncrypter({ nip04, nip44 });

		await expect(encrypter('author', [])).resolves.toBe('');
		expect(nip04.encrypt).not.toHaveBeenCalled();
		expect(nip44.encrypt).not.toHaveBeenCalled();
	});

	it('does not fall back to NIP-04 for current list content', async () => {
		const nip04 = { encrypt: vi.fn(), decrypt: vi.fn() };
		const encrypter = createListContentEncrypter({ nip04 });

		await expect(encrypter('author', [['p', 'private']])).rejects.toThrow(
			'NIP-44 encryption capability is unavailable'
		);
		expect(nip04.encrypt).not.toHaveBeenCalled();
	});

	it('does not fall back to NIP-44 for legacy list content', async () => {
		const nip44 = { encrypt: vi.fn(), decrypt: vi.fn() };
		const encrypter = createListContentEncrypter({ nip44 });

		await expect(encrypter('author', [['p', 'private']], true)).rejects.toThrow(
			'NIP-04 encryption capability is unavailable'
		);
		expect(nip44.encrypt).not.toHaveBeenCalled();
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
