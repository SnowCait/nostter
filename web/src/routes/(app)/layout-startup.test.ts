import { describe, expect, it } from 'vitest';
import fs from 'fs/promises';

describe('+layout.svelte', () => {
	it('gates session-scoped startup on auth.isAuthenticated, not just author being set', async () => {
		const source = await fs.readFile(new URL('./+layout.svelte', import.meta.url), 'utf-8');

		const effectBody = source.match(
			/let initialized = false;\s*\$effect\(\(\) => \{([\s\S]*?)\}\);/
		)?.[1];
		expect(effectBody).toBeDefined();

		expect(effectBody).toMatch(
			/if\s*\(\s*!auth\.isAuthenticated\s*\|\|\s*\$author === undefined\s*\|\|\s*initialized\s*\)/
		);
	});
});
