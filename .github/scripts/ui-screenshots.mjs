import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

export async function inventory(root) {
	const files = (await readdir(root, { recursive: true }))
		.filter((p) => p.endsWith('.png'))
		.sort();
	const entries = {};
	for (const file of files) {
		if (!/^[a-zA-Z0-9_/-]+\.(desktop|mobile)\.png$/.test(file)) {
			throw new Error('Invalid screenshot name');
		}
		const data = await readFile(join(root, file));
		PNG.sync.read(data);
		entries[file] = createHash('sha256').update(data).digest('hex');
	}
	return entries;
}
export async function manifest(root) {
	await mkdir(root, { recursive: true });
	const { version } = JSON.parse(await readFile('node_modules/playwright/package.json'));
	await writeFile(
		join(root, 'manifest.json'),
		JSON.stringify({
			environment: `${process.env.ImageOS}/${process.env.ImageVersion}/${version}`,
			files: await inventory(root)
		})
	);
}
export async function compare(before, after, diff) {
	const load = async (root) => {
		const metadata = JSON.parse(await readFile(join(root, 'manifest.json')));
		if (typeof metadata.environment !== 'string') {
			throw new Error('Missing rendering environment');
		}
		if (JSON.stringify(metadata.files) !== JSON.stringify(await inventory(root))) {
			throw new Error('Incomplete artifact');
		}
		return metadata;
	};
	const a = await load(before),
		b = await load(after);
	if (a.environment !== b.environment) {
		throw new Error('Rendering environment changed');
	}
	const changes = [];
	for (const file of [...new Set([...Object.keys(a.files), ...Object.keys(b.files)])].sort()) {
		if (!a.files[file] || !b.files[file]) {
			changes.push({ file, kind: a.files[file] ? 'deleted' : 'added' });
			continue;
		}
		const old = PNG.sync.read(await readFile(join(before, file))),
			next = PNG.sync.read(await readFile(join(after, file)));
		const width = Math.max(old.width, next.width),
			height = Math.max(old.height, next.height);
		const pad = (png) => {
			const out = new PNG({ width, height });
			PNG.bitblt(png, out, 0, 0, png.width, png.height, 0, 0);
			return out;
		};
		const output = new PNG({ width, height });
		// Pixelmatch's default perceptual threshold ignores minor color and antialiasing noise.
		const pixels = pixelmatch(pad(old).data, pad(next).data, output.data, width, height, {
			threshold: 0.1
		});
		if (pixels || old.width !== next.width || old.height !== next.height) {
			changes.push({ file, kind: 'changed' });
			await mkdir(join(diff, file, '..'), { recursive: true });
			await writeFile(join(diff, file), PNG.sync.write(output));
		}
	}
	return changes;
}
if (process.argv[2] === 'manifest') {
	await manifest(process.argv[3]);
}
if (process.argv[2] === 'compare') {
	const changes = await compare(...process.argv.slice(3, 6));
	await writeFile(process.argv[6], JSON.stringify(changes));
	if (process.env.GITHUB_OUTPUT) {
		await writeFile(process.env.GITHUB_OUTPUT, `changes=${JSON.stringify(changes)}\n`, {
			flag: 'a'
		});
	}
}
