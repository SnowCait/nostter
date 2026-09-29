import { expect, test, type Page } from '@playwright/test';

type SentDiagnostic = { body: Record<string, unknown>; status?: number };

const stylesheetAssets = /\/_app\/immutable\/assets\/[^/]+\.css$/;

const recordDiagnostics = (page: Page) =>
	page.addInitScript(() => {
		const sent: SentDiagnostic[] = [];
		Object.assign(window, { sentDiagnostics: sent });
		const fetch = window.fetch;
		window.fetch = (input, init) => {
			if (input !== '/api/diagnostics/client') {
				return fetch(input, init);
			}
			const diagnostic: SentDiagnostic = { body: JSON.parse(String(init?.body)) };
			sent.push(diagnostic);
			return fetch(input, init).then((response) => {
				diagnostic.status = response.status;
				return response;
			});
		};
	});

const sentDiagnostics = (page: Page) =>
	page.evaluate(
		() => (window as unknown as { sentDiagnostics: SentDiagnostic[] }).sentDiagnostics
	);

const appendFailingStylesheet = (page: Page) =>
	page.evaluate(
		() =>
			new Promise((resolve) => {
				const link = document.createElement('link');
				link.rel = 'stylesheet';
				link.href = '/_app/immutable/assets/missing.css';
				link.addEventListener('error', resolve);
				document.head.append(link);
			})
	);

test('does not send diagnostics when stylesheets are applied', async ({ page }) => {
	await recordDiagnostics(page);
	await page.goto('/about');

	expect(await sentDiagnostics(page)).toEqual([]);
});

test('sends a stylesheet load error once per document', async ({ page }) => {
	await recordDiagnostics(page);
	await page.route(stylesheetAssets, (route) => route.abort());
	await page.goto('/about?q=query#hash');
	await appendFailingStylesheet(page);

	await expect
		.poll(async () =>
			(await sentDiagnostics(page)).map(({ body, status }) => [body.type, status])
		)
		.toEqual([
			['stylesheet-load-error', 204],
			['stylesheet-not-applied', 204]
		]);

	const [{ body }] = await sentDiagnostics(page);
	expect(body).toMatchObject({
		pathname: '/about',
		stylesheetPath: expect.stringMatching(stylesheetAssets),
		stylesheetPaths: expect.arrayContaining([expect.stringMatching(stylesheetAssets)]),
		unavailableStylesheetPaths: expect.arrayContaining([body.stylesheetPath])
	});
	expect(JSON.stringify(body)).not.toMatch(/query|hash|localhost/);
});

test('sends stylesheet-not-applied when stylesheets load without applying', async ({ page }) => {
	await recordDiagnostics(page);
	await page.route(stylesheetAssets, (route) =>
		route.fulfill({ contentType: 'text/css', body: '' })
	);
	await page.goto('/unknown/npub1sg6plzptd64u62a878hep2kev88swjh3tw00gjsfl8f237lmu63q0uf63m');

	await expect
		.poll(async () =>
			(await sentDiagnostics(page)).map(({ body, status }) => [body.type, status])
		)
		.toEqual([['stylesheet-not-applied', 204]]);

	const [{ body }] = await sentDiagnostics(page);
	expect(body).toMatchObject({
		pathname: '/unknown/[npub]',
		stylesheetPaths: expect.arrayContaining([expect.stringMatching(stylesheetAssets)]),
		unavailableStylesheetPaths: []
	});
	expect(body).not.toHaveProperty('stylesheetPath');
});

test('sends the response status of a stylesheet that failed with an HTTP error', async ({
	page
}) => {
	await recordDiagnostics(page);
	await page.route(stylesheetAssets, (route) => route.fulfill({ status: 503, body: '' }));
	await page.goto('/about');

	await expect
		.poll(async () => (await sentDiagnostics(page)).map(({ body }) => body.type))
		.toContain('stylesheet-load-error');

	const { body } = (await sentDiagnostics(page)).find(
		({ body }) => body.type === 'stylesheet-load-error'
	)!;
	const paths = body.stylesheetPaths as string[];
	const statuses = body.stylesheetResponseStatuses as (number | null)[];
	expect(statuses).toHaveLength(paths.length);
	expect(statuses[paths.indexOf(body.stylesheetPath as string)]).toBe(503);
});
