import { describe, expect, it } from 'vitest';
import fs from 'fs/promises';

describe('NotificationVisibility.svelte', () => {
	it('gates loader startup on auth.isAuthenticated, not just the selected visibility', async () => {
		const source = await fs.readFile(
			new URL('./NotificationVisibility.svelte', import.meta.url),
			'utf-8'
		);

		const effectBody = source.match(/\$effect\(\(\) => \{([\s\S]*?)\}\);/)?.[1];
		expect(effectBody).toBeDefined();

		expect(effectBody).toMatch(
			/if\s*\(\s*\$notificationVisibility === 'follows_of_follows' && auth\.isAuthenticated\s*\)/
		);
	});

	it('does not make followees a reactive dependency of the effect', async () => {
		const source = await fs.readFile(
			new URL('./NotificationVisibility.svelte', import.meta.url),
			'utf-8'
		);

		expect(source).toContain('untrack(() => auth.followees)');
	});
});
