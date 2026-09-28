import { expect, test } from '@playwright/test';
import { build, transform } from 'esbuild';
import { compileModule } from 'svelte/compiler';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import type * as RuntimeModule from '../src/lib/features/mute/application/regular-mute-runtime.svelte';
import type * as AuthorModule from '../src/lib/stores/Author';

const webRoot = fileURLToPath(new URL('..', import.meta.url));

async function bundleCompatibilityBoundary(): Promise<string> {
	const entry = `
		import * as runtime from './src/lib/features/mute/application/regular-mute-runtime.svelte.ts';
		import * as author from './src/lib/stores/Author.ts';
		globalThis.regularMuteTest = { runtime, author };
	`;
	const result = await build({
		stdin: {
			contents: entry,
			resolveDir: webRoot,
			sourcefile: 'regular-mute-test.ts',
			loader: 'ts'
		},
		bundle: true,
		write: false,
		format: 'iife',
		platform: 'browser',
		conditions: ['browser'],
		define: { 'import.meta.env': '{}' },
		alias: { $lib: resolve(webRoot, 'src/lib') },
		plugins: [
			{
				name: 'compile-svelte-runes',
				setup(builder) {
					builder.onLoad({ filter: /\.svelte\.ts$/ }, async ({ path }) => {
						const source = await transform(await readFile(path, 'utf8'), {
							loader: 'ts',
							format: 'esm'
						});
						return {
							contents: compileModule(source.code, {
								filename: path,
								generate: 'client'
							}).js.code,
							loader: 'js'
						};
					});
				}
			}
		]
	});
	return result.outputFiles[0].text;
}

test('regular mute compatibility Stores follow Rune state without exposing it', async ({
	page
}) => {
	await page.addScriptTag({ content: await bundleCompatibilityBoundary() });
	const result = await page.evaluate(async () => {
		const { runtime, author } = (
			globalThis as typeof globalThis & {
				regularMuteTest: { runtime: typeof RuntimeModule; author: typeof AuthorModule };
			}
		).regularMuteTest;
		const owner = 'a'.repeat(64);
		const event = {
			id: 'confirmed',
			pubkey: owner,
			kind: 10000,
			created_at: 1,
			tags: [['p', 'public']],
			content: '',
			sig: 'sig'
		};
		runtime.resetRegularMute();
		runtime.applyRegularMuteInitialization(
			owner,
			{
				event,
				tags: { pubkeys: ['public'], eventIds: [], words: [] }
			},
			runtime.regularMuteRevision()
		);
		const observed: string[][] = [];
		const optimisticSeen = Promise.withResolvers<string[]>();
		const restoredSeen = Promise.withResolvers<void>();
		const unsubscribe = author.mutePubkeys.subscribe((pubkeys) => {
			observed.push([...pubkeys]);
			if (pubkeys.includes('optimistic')) {
				optimisticSeen.resolve(pubkeys);
			}
			if (
				pubkeys.includes('public') &&
				observed.some((value) => value.includes('optimistic'))
			) {
				restoredSeen.resolve();
			}
		});
		const eventSeen =
			Promise.withResolvers<NonNullable<ReturnType<typeof runtime.getCanonicalMuteEvent>>>();
		const unsubscribeEvent = author.muteEvent.subscribe((value) => {
			if (value?.id === event.id) {
				eventSeen.resolve(value);
			}
		});
		const token = runtime.startOptimisticMute(owner, {
			pubkeys: ['optimistic'],
			eventIds: [],
			words: []
		});
		const projectedTags = await optimisticSeen.promise;
		const projectedEvent = await eventSeen.promise;
		projectedTags.push('mutated');
		projectedEvent.tags.push(['p', 'mutated']);
		const effectiveTags = runtime.getEffectiveMuteTags().pubkeys;
		const canonicalTags = runtime.getCanonicalMuteEvent()?.tags;
		runtime.clearOptimisticMute(owner, token);
		await restoredSeen.promise;
		unsubscribe();
		unsubscribeEvent();
		return {
			observed,
			effectiveTags,
			canonicalTags,
			readonly: [
				author.muteEvent,
				author.mutePubkeys,
				author.muteEventIds,
				author.muteWords
			].every((store) => !('set' in store) && !('update' in store))
		};
	});
	expect(result.readonly).toBe(true);
	expect(result.observed).toEqual([['public'], ['optimistic'], ['public']]);
	expect(result.effectiveTags).toEqual(['optimistic']);
	expect(result.canonicalTags).toEqual([['p', 'public']]);
});
