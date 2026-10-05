import { expect, test, type Page } from '@playwright/test';
import { recordDiagnostics, sentDiagnostics } from './client-diagnostics-helpers';

const appendFailingModulepreloads = (page: Page, paths: string[]) =>
	page.evaluate(async (paths) => {
		for (const path of paths) {
			await new Promise((resolve) => {
				const link = document.createElement('link');
				link.rel = 'modulepreload';
				link.href = path;
				link.addEventListener('error', resolve);
				document.head.append(link);
			});
		}
	}, paths);

test('sends a JavaScript load error once per document when modulepreload assets fail', async ({
	page
}) => {
	await recordDiagnostics(page);
	await page.route('**/_app/immutable/test/*.js', (route) =>
		route.fulfill({ status: 404, body: '' })
	);
	await page.goto('/about?q=query#hash', { waitUntil: 'networkidle' });
	await appendFailingModulepreloads(page, [
		'/_app/immutable/test/0.js?q=query#hash',
		'/_app/immutable/test/1.js',
		'/_app/immutable/test/2.js'
	]);

	await expect
		.poll(async () =>
			(await sentDiagnostics(page)).map(({ body, status }) => [body.type, status])
		)
		.toEqual([['javascript-load-error', 204]]);

	const [{ body }] = await sentDiagnostics(page);
	expect(body).toMatchObject({
		trigger: 'modulepreload',
		javascriptPath: '/_app/immutable/test/0.js',
		javascriptResponseStatus: 404,
		pathname: '/about',
		javascriptResources: expect.arrayContaining([
			{
				path: '/_app/immutable/test/0.js',
				initiatorType: expect.any(String),
				responseStatus: 404
			}
		])
	});
	expect(body).not.toHaveProperty('stylesheetPaths');
	expect(JSON.stringify(body)).not.toMatch(/query|hash|localhost/);
});

test('does not send a JavaScript load error for modulepreload outside immutable assets', async ({
	page
}) => {
	await recordDiagnostics(page);
	await page.route('**/missing.js', (route) => route.fulfill({ status: 404, body: '' }));
	await page.goto('/about', { waitUntil: 'networkidle' });
	await appendFailingModulepreloads(page, ['/_app/missing.js']);

	expect(await sentDiagnostics(page)).toEqual([]);
});
