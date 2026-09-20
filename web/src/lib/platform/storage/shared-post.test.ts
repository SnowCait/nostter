import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { consumeSharedPost, saveSharedPost } from './shared-post';

describe('shared post storage', () => {
	it('preserves multiple files and consumes a share only once', async () => {
		const files = [
			new File(['first'], 'first.png', { type: 'image/png' }),
			new File(['second'], 'second.webp', { type: 'image/webp' })
		];
		const id = await saveSharedPost({ title: 'title', text: 'text', url: null, files });

		const share = await consumeSharedPost(id);
		expect(share).toMatchObject({ id, title: 'title', text: 'text', url: null });
		expect(share?.files).toHaveLength(2);
		expect(share?.files.map((file) => [file.name, file.type])).toEqual([
			['first.png', 'image/png'],
			['second.webp', 'image/webp']
		]);
		expect(await share?.files[0].text()).toBe('first');
		expect(await share?.files[1].text()).toBe('second');
		await expect(consumeSharedPost(id)).resolves.toBeUndefined();
	});
});
