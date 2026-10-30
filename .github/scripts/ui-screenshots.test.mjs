import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { inventory, compare } from './ui-screenshots.mjs';

test('detects changes, additions, deletions and rejects incomplete or incompatible artifacts', async () => {
	const root = await mkdtemp(join(tmpdir(), 'ui-diff-'));
	try {
		const before = join(root, 'before'),
			after = join(root, 'after'),
			diff = join(root, 'diff');
		for (const dir of [before, after]) {
			await mkdir(join(dir, 'login'), { recursive: true });
		}
		const image = (color) => {
			const png = new PNG({ width: 10, height: 10 });
			for (let i = 0; i < png.data.length; i += 4) {
				png.data[i] = color;
				png.data[i + 3] = 255;
			}
			return PNG.sync.write(png);
		};
		const put = async (dir, name, color) =>
			writeFile(join(dir, `login/${name}.desktop.png`), image(color));
		const seal = async (dir, environment = 'same') =>
			writeFile(
				join(dir, 'manifest.json'),
				JSON.stringify({ environment, files: await inventory(dir) })
			);
		await put(before, 'same', 0);
		await put(after, 'same', 0);
		await seal(before);
		await seal(after);
		assert.deepEqual(await compare(before, after, diff), []);
		await put(before, 'changed', 0);
		await put(after, 'changed', 255);
		await put(before, 'deleted', 0);
		await put(after, 'added', 0);
		await seal(before);
		await seal(after);
		assert.deepEqual(
			(await compare(before, after, diff)).map((c) => c.kind),
			['added', 'changed', 'deleted']
		);
		assert.ok((await readFile(join(diff, 'login/changed.desktop.png'))).length);
		await put(after, 'same', 100);
		await assert.rejects(compare(before, after, diff), /Incomplete/);
		await seal(after, 'other');
		await assert.rejects(compare(before, after, diff), /environment/);
		await rm(join(after, 'login'), { recursive: true });
		await seal(after);
		assert.deepEqual(
			(await compare(before, after, diff)).map((c) => c.kind),
			['deleted', 'deleted', 'deleted']
		);
		await rm(join(before, 'manifest.json'));
		await assert.rejects(compare(before, after, diff));
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
