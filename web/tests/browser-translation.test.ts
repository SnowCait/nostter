import { test, expect } from '@playwright/test';
import { build, transform } from 'esbuild';
import { compile, compileModule } from 'svelte/compiler';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
let bundle: string;
test.beforeAll(async () => {
	const result = await build({
		stdin: {
			contents: `
				import { mount, unmount } from 'svelte';
				import { init, addMessages } from 'svelte-i18n';
				import messages from './src/lib/i18n/locales/en.json';
				import japanese from './src/lib/i18n/locales/ja.json';
				import Component from './src/lib/features/translation/presentation/BrowserTranslation.svelte';
				addMessages('en', messages);
				addMessages('ja', japanese);
				await init({ initialLocale: globalThis.translationUiLanguage ?? 'en', fallbackLocale: 'en' });
				const instance = mount(Component, { target: document.body, props: { text: 'Bonjour tout le monde', getDisplayName: () => undefined } });
				globalThis.removeTranslation = () => unmount(instance);
			`,
			resolveDir: root,
			loader: 'ts'
		},
		bundle: true,
		write: false,
		format: 'esm',
		conditions: ['browser'],
		plugins: [
			{
				name: 'svelte',
				setup(builder) {
					builder.onLoad({ filter: /\.svelte$/ }, async ({ path }) => ({
						contents: compile(await readFile(path, 'utf8'), {
							filename: path,
							generate: 'client',
							css: 'injected'
						}).js.code,
						loader: 'js'
					}));
					builder.onLoad({ filter: /\.svelte\.(ts|js)$/ }, async ({ path }) => ({
						contents: compileModule(
							(
								await transform(await readFile(path, 'utf8'), {
									loader: path.endsWith('.ts') ? 'ts' : 'js'
								})
							).code,
							{ filename: path, generate: 'client' }
						).js.code,
						loader: 'js'
					}));
				}
			}
		]
	});
	bundle = result.outputFiles[0].text;
});
async function setup(
	page: import('@playwright/test').Page,
	uncertain = false,
	preferences?: { ui: string; browser: string; source: string }
) {
	await page.setContent('<html><body></body></html>');
	await page.addStyleTag({ content: await readFile(root + '/src/app.css', 'utf8') });
	await page.evaluate(
		({ uncertain, preferences }) => {
			if (preferences) {
				Object.defineProperty(navigator, 'languages', {
					configurable: true,
					value: [preferences.browser]
				});
				Object.defineProperty(navigator, 'language', {
					configurable: true,
					value: preferences.browser
				});
				Object.assign(globalThis, { translationUiLanguage: preferences.ui });
			}
			const state = { aborted: false, translations: 0, target: '' };
			Object.assign(globalThis, {
				translationTest: state,
				LanguageDetector: {
					availability: async () => 'available',
					create: async () => ({
						detect: async () => [
							{
								detectedLanguage: preferences?.source ?? 'fr',
								confidence: uncertain ? 0.2 : 0.99
							}
						],
						destroy() {}
					})
				},
				Translator: {
					availability: async () => 'downloadable',
					create: async ({
						signal,
						targetLanguage
					}: {
						signal: AbortSignal;
						targetLanguage: string;
					}) => {
						state.target = targetLanguage;
						signal.addEventListener('abort', () => {
							state.aborted = true;
						});
						return {
							translate: async () => {
								state.translations++;
								return 'Hello everyone';
							},
							destroy() {}
						};
					}
				}
			});
		},
		{ uncertain, preferences }
	);
	await page.addScriptTag({ content: bundle, type: 'module' });
}
test('text control, all dialog cancellation paths, and retry without an extra click', async ({
	page
}) => {
	await setup(page);
	const show = page.getByRole('button', { name: 'Show translation', exact: true });
	await expect(show).toBeVisible();
	expect(
		await show.evaluate((element) => {
			const style = getComputedStyle(element);
			return [style.backgroundColor, style.paddingTop, style.borderRadius];
		})
	).toEqual(['rgba(0, 0, 0, 0)', '0px', '0px']);
	for (const method of ['button', 'escape', 'outside']) {
		await show.click();
		await expect(page.getByRole('dialog')).toBeVisible();
		if (method === 'button') {
			await page.getByRole('button', { name: 'Cancel', exact: true }).click();
		}
		if (method === 'escape') {
			await page.keyboard.press('Escape');
		}
		if (method === 'outside') {
			await page.mouse.click(1, 1);
		}
		await expect(page.getByRole('dialog')).toHaveCount(0);
		await expect(show).toBeEnabled();
		await expect(page.locator('.translation')).not.toContainText('translation.cancelled');
		await expect(page.locator('.translation')).not.toContainText('failed');
	}
	await show.click();
	await page.getByRole('button', { name: 'Start translation', exact: true }).click();
	await expect(page.locator('.result')).toHaveText('Hello everyone');
	await expect(page.getByRole('button', { name: 'Continue preparing models' })).toHaveCount(0);
});

test('uncertain detection offers Google Translate without opening it automatically', async ({
	page
}) => {
	await setup(page, true);
	const popups: import('@playwright/test').Page[] = [];
	page.on('popup', (popup) => popups.push(popup));
	await page.getByRole('button', { name: 'Show translation', exact: true }).click();
	await expect(page.getByText('The language of this post could not be detected.')).toBeVisible();
	await expect(page.locator('input, form')).toHaveCount(0);
	const link = page.getByRole('link', { name: 'Open in Google Translate' });
	await expect(link).toBeVisible();
	await expect(link).toHaveAttribute('target', '_blank');
	await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
	const href = await link.getAttribute('href');
	const url = new URL(href!);
	expect(url.searchParams.get('text')).toBe('Bonjour tout le monde');
	expect(href).toBe(
		'https://translate.google.com/?sl=auto&text=Bonjour%20tout%20le%20monde&op=translate'
	);
	expect(popups).toHaveLength(0);
	// Abort the external request while still checking that the user opens a new tab.
	await page.context().route('https://translate.google.com/**', (route) => route.abort());
	const popup = page.waitForEvent('popup');
	await link.click();
	await (await popup).close();
});

test('unmount aborts an in-flight translation without showing a late result', async ({ page }) => {
	await setup(page);
	await page.evaluate(() => {
		Object.assign(globalThis, {
			Translator: {
				availability: async () => 'available',
				create: async ({ signal }: { signal: AbortSignal }) => ({
					translate: () =>
						new Promise<string>((resolve) => {
							Object.assign(globalThis, {
								finishTranslation: () => resolve('Late result')
							});
							signal.addEventListener('abort', () => {
								Object.assign(globalThis, { translationAborted: true });
							});
						}),
					destroy() {}
				})
			}
		});
	});
	await page.getByRole('button', { name: 'Show translation', exact: true }).click();
	await expect.poll(() => page.evaluate(() => 'finishTranslation' in globalThis)).toBe(true);
	await expect(page.getByText('Preparing models…', { exact: true })).toHaveCount(0);
	await expect(page.getByText('Translating…', { exact: true })).toBeVisible();
	await page.evaluate(async () => {
		const controls = globalThis as unknown as {
			removeTranslation(): Promise<void>;
			finishTranslation(): void;
		};
		await controls.removeTranslation();
		controls.finishTranslation();
	});
	await expect.poll(() => page.evaluate(() => 'translationAborted' in globalThis)).toBe(true);
	await expect(page.locator('.translation')).toHaveCount(0);
	await expect(page.getByText('Late result')).toHaveCount(0);
});

test('shows model preparation for both models, then translation without progress percentages', async ({
	page
}) => {
	await setup(page);
	await expect(page.getByRole('button', { name: 'Show translation', exact: true })).toBeVisible();
	await page.evaluate(() => {
		Object.assign(globalThis, {
			LanguageDetector: {
				availability: async () => 'downloadable',
				create: () =>
					new Promise((resolve) => {
						Object.assign(globalThis, {
							finishDetector: () =>
								resolve({
									detect: async () => [
										{ detectedLanguage: 'fr', confidence: 0.99 }
									],
									destroy() {}
								})
						});
					})
			},
			Translator: {
				availability: async () => 'downloadable',
				create: () =>
					new Promise((resolve) => {
						Object.assign(globalThis, {
							finishModel: () =>
								resolve({
									translate: () =>
										new Promise((resolveText) => {
											Object.assign(globalThis, {
												finishText: () => resolveText('Hello everyone')
											});
										}),
									destroy() {}
								})
						});
					})
			}
		});
	});
	await page.getByRole('button', { name: 'Show translation', exact: true }).click();
	await expect(page.getByText('Preparing models…', { exact: true })).toHaveCount(0);
	await page
		.getByRole('dialog')
		.getByRole('button', { name: 'Start translation', exact: true })
		.click();
	await expect(page.getByText('Preparing models…', { exact: true })).toBeVisible();
	await expect(page.locator('progress')).toHaveCount(0);
	await page.evaluate('finishDetector()');
	await expect.poll(() => page.evaluate(() => 'finishModel' in globalThis)).toBe(true);
	await expect(page.getByRole('dialog')).toHaveCount(0);
	await expect(page.getByText('Preparing models…', { exact: true })).toBeVisible();
	await page.evaluate('finishModel()');
	await expect(page.getByText('Preparing models…', { exact: true })).toHaveCount(0);
	await expect(page.getByText('Translating…', { exact: true })).toBeVisible();
	await page.evaluate('finishText()');
	await expect(page.locator('.result')).toHaveText('Hello everyone');
	await expect(page.getByText('Translating…', { exact: true })).toHaveCount(0);
});

test('model confirmation fits a narrow screen in both themes', async ({ page }) => {
	await page.setViewportSize({ width: 320, height: 640 });
	await setup(page);
	for (const theme of ['light', 'dark']) {
		await page.evaluate(
			(theme) => document.documentElement.classList.toggle('dark', theme === 'dark'),
			theme
		);
		await page.getByRole('button', { name: 'Show translation', exact: true }).click();
		const dialog = page.getByRole('dialog');
		await expect(
			dialog.getByRole('heading', { name: 'In-browser translation', exact: true })
		).toBeVisible();
		await expect(
			dialog.getByText('This feature is experimental. Translations may be inaccurate.')
		).toBeVisible();
		const box = await dialog.boundingBox();
		expect(box!.x).toBeGreaterThanOrEqual(0);
		expect(box!.x + box!.width).toBeLessThanOrEqual(320);
		expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
			true
		);
		for (const name of ['Cancel', 'Start translation']) {
			const action = await dialog.getByRole('button', { name, exact: true }).boundingBox();
			expect(action!.x + action!.width).toBeLessThanOrEqual(box!.x + box!.width);
		}
		await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
		await expect(dialog).toHaveCount(0);
	}
});

for (const [ui, browser, target] of [
	['ja', 'en-US', 'en'],
	['en', 'ja-JP', 'ja'],
	['en', 'fr-FR', 'fr']
]) {
	test('uses browser ' + browser + ' independently of UI ' + ui, async ({ page }) => {
		await setup(page, false, { ui, browser, source: 'de' });
		const toggle = page.locator('.translation-toggle');
		await expect(toggle).toHaveText(ui === 'ja' ? '翻訳を表示' : 'Show translation');
		await toggle.click();
		await page.getByRole('dialog').getByRole('button').last().click();
		await expect(page.locator('.result')).toHaveAttribute('lang', target);
		expect(
			await page.evaluate(
				() =>
					(globalThis as unknown as { translationTest: { target: string } })
						.translationTest.target
			)
		).toBe(target);
	});
}
test('clears an old translation when the browser preference changes', async ({ page }) => {
	await setup(page, false, { ui: 'en', browser: 'en-US', source: 'de' });
	await page.locator('.translation-toggle').click();
	await page.getByRole('dialog').getByRole('button').last().click();
	await expect(page.locator('.result')).toHaveAttribute('lang', 'en');
	await page.evaluate(() => {
		Object.defineProperty(navigator, 'languages', { configurable: true, value: ['ja-JP'] });
		window.dispatchEvent(new Event('languagechange'));
	});
	await expect(page.locator('.result')).toHaveCount(0);
	await page.locator('.translation-toggle').click();
	await page.getByRole('dialog').getByRole('button').last().click();
	await expect(page.locator('.result')).toHaveAttribute('lang', 'ja');
});
