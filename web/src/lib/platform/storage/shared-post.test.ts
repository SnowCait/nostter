import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { consumeSharedPost, saveSharedPost } from './shared-post';

afterEach(() => {
	vi.restoreAllMocks();
});

describe('shared post storage', () => {
	it('preserves multiple files and consumes a share only once', async () => {
		const files = [
			new File(['first'], 'first.png', { type: 'image/png' }),
			new File(['second'], 'second.webp', { type: 'image/webp' })
		];
		const id = await saveSharedPost({ title: 'title', text: 'text', url: null, files });

		const share = await consumeSharedPost(id);
		expect(share).toMatchObject({
			id,
			createdAt: expect.any(Number),
			title: 'title',
			text: 'text',
			url: null
		});
		expect(share?.files).toHaveLength(2);
		expect(share?.files.map((file) => [file.name, file.type])).toEqual([
			['first.png', 'image/png'],
			['second.webp', 'image/webp']
		]);
		expect(await share?.files[0].text()).toBe('first');
		expect(await share?.files[1].text()).toBe('second');
		await expect(consumeSharedPost(id)).resolves.toBeUndefined();
	});

	it('consumes shares through the TTL boundary', async () => {
		const createdAt = new Date('2026-01-01T00:00:00Z').valueOf();
		vi.spyOn(Date, 'now').mockReturnValue(createdAt);
		const id = await saveSharedPost({ title: null, text: 'recent', url: null, files: [] });

		vi.mocked(Date.now).mockReturnValue(createdAt + 60 * 60 * 1000);
		await expect(consumeSharedPost(id)).resolves.toMatchObject({ id, text: 'recent' });
	});

	it('expires and removes a share when consumed after its TTL', async () => {
		const createdAt = new Date('2026-01-01T00:00:00Z').valueOf();
		vi.spyOn(Date, 'now').mockReturnValue(createdAt);
		const id = await saveSharedPost({ title: null, text: 'expired', url: null, files: [] });

		vi.mocked(Date.now).mockReturnValue(createdAt + 60 * 60 * 1000 + 1);
		await expect(consumeSharedPost(id)).resolves.toBeUndefined();
		await expect(consumeSharedPost(id)).resolves.toBeUndefined();
	});

	it('removes expired unconsumed shares when saving a new share', async () => {
		const createdAt = new Date('2026-01-01T00:00:00Z').valueOf();
		vi.spyOn(Date, 'now').mockReturnValue(createdAt);
		const expiredId = await saveSharedPost({
			title: null,
			text: 'expired',
			url: null,
			files: []
		});

		vi.mocked(Date.now).mockReturnValue(createdAt + 60 * 60 * 1000 + 1);
		const recentId = await saveSharedPost({
			title: null,
			text: 'recent',
			url: null,
			files: []
		});

		await expect(consumeSharedPost(expiredId)).resolves.toBeUndefined();
		await expect(consumeSharedPost(recentId)).resolves.toMatchObject({ id: recentId });
	});
});
