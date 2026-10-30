import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

const baseline = resolve('test-results/ui-baseline');
const current = resolve('test-results/ui-current');
const images = (directory: string) =>
	readdirSync(directory, { recursive: true })
		.map(String)
		.filter((file) => file.endsWith('.png'));
const before = images(baseline);
const after = images(current);
if (!before.length || !after.length) {
	throw new Error('Screenshot artifacts are missing or empty');
}

for (const file of new Set([...before, ...after])) {
	test(file, () => {
		const actual = resolve(current, file);
		expect(existsSync(actual), `Screenshot removed: ${file}`).toBe(true);
		expect(readFileSync(actual)).toMatchSnapshot(file.split('/'));
	});
}
