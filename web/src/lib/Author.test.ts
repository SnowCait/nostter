import { describe, expect, it } from 'vitest';
import fs from 'fs/promises';

describe('Author.fetchEvents', () => {
	it('does not start the followees-of-followees loader', async () => {
		const source = await fs.readFile(new URL('./Author.ts', import.meta.url), 'utf-8');

		expect(source).not.toContain('loadFolloweesOfFollowees');
		expect(source).not.toContain('notificationVisibility');
	});
});
