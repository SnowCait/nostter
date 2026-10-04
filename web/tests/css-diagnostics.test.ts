import { expect, test, type Page } from '@playwright/test';

type SentDiagnostic = { body: Record<string, unknown>; status?: number };

const stylesheetAssets = /\/_app\/immutable\/assets\/[^/]+\.css$/;
const javascriptAssets = /\/_app\/immutable\/.+\.js$/;

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

test('omits the Git SHA when the build has none', async ({ page }) => {
	await recordDiagnostics(page);
	await page.goto('/about');
	expect(await page.locator('html').getAttribute('data-git-sha')).toBe('');
	await appendFailingStylesheet(page);

	await expect
		.poll(async () => (await sentDiagnostics(page)).map(({ status }) => status))
		.toEqual([204]);

	const [{ body }] = await sentDiagnostics(page);
	expect(body).not.toHaveProperty('gitSha');
});

test('sends the Git SHA of the build that rendered the document', async ({ page }) => {
	const gitSha = '0123456789abcdef0123456789abcdef01234567';
	await recordDiagnostics(page);
	await page.route('/about', async (route) => {
		const response = await route.fetch();
		const body = (await response.text()).replace(
			/data-git-sha="[^"]*"/,
			`data-git-sha="${gitSha}"`
		);
		await route.fulfill({ response, body });
	});
	await page.goto('/about');
	await appendFailingStylesheet(page);

	await expect
		.poll(async () => (await sentDiagnostics(page)).map(({ status }) => status))
		.toEqual([204]);

	const [{ body }] = await sentDiagnostics(page);
	expect(body.gitSha).toBe(gitSha);
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
		trigger: 'load',
		pathname: '/unknown/[npub]',
		stylesheetPaths: expect.arrayContaining([expect.stringMatching(stylesheetAssets)]),
		unavailableStylesheetPaths: []
	});
	expect(body).not.toHaveProperty('stylesheetPath');
});

test('sends stylesheet-not-applied detected on returning to the foreground', async ({ page }) => {
	await recordDiagnostics(page);
	await page.goto('/about');
	await page.evaluate(() => {
		for (const sheet of document.styleSheets) {
			sheet.disabled = true;
		}
	});

	const changeVisibility = (visibilityState: DocumentVisibilityState) =>
		page.evaluate((visibilityState) => {
			Object.defineProperty(document, 'visibilityState', {
				configurable: true,
				get: () => visibilityState
			});
			document.dispatchEvent(new Event('visibilitychange'));
		}, visibilityState);

	await changeVisibility('hidden');
	expect(await sentDiagnostics(page)).toEqual([]);

	await changeVisibility('visible');
	await expect
		.poll(async () =>
			(await sentDiagnostics(page)).map(({ body, status }) => [body.type, status])
		)
		.toEqual([['stylesheet-not-applied', 204]]);

	const [{ body }] = await sentDiagnostics(page);
	expect(body.trigger).toBe('visibilitychange');
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

test('sends the response status of JavaScript assets that failed with stylesheets', async ({
	page
}) => {
	await recordDiagnostics(page);
	await page.route(stylesheetAssets, (route) =>
		route.fulfill({ contentType: 'text/css', body: '' })
	);
	await page.route(javascriptAssets, (route) => route.fulfill({ status: 503, body: '' }));
	await page.goto('/about');

	await expect
		.poll(async () => (await sentDiagnostics(page)).map(({ body }) => body.type))
		.toEqual(['stylesheet-not-applied']);

	const [{ body }] = await sentDiagnostics(page);
	const resources = body.javascriptResources as Record<string, unknown>[];
	expect(resources.length).toBeGreaterThan(0);
	expect(resources.length).toBeLessThanOrEqual(16);
	expect(new Set(resources.map(({ path }) => path)).size).toBe(resources.length);
	for (const resource of resources) {
		expect(resource).toEqual({
			path: expect.stringMatching(/^\/_app\/immutable\/.+\.js$/),
			initiatorType: expect.any(String),
			responseStatus: 503
		});
	}
});

test('sends the newest unique JavaScript assets with their latest entries', async ({ page }) => {
	await recordDiagnostics(page);
	await page.route('**/_app/immutable/test/*.js?status=*', (route) =>
		route.fulfill({
			status: Number(new URL(route.request().url()).searchParams.get('status')),
			contentType: 'text/javascript',
			body: ''
		})
	);
	await page.goto('/about', { waitUntil: 'networkidle' });
	await page.evaluate(async () => {
		for (let i = 0; i < 20; i++) {
			await fetch(`/_app/immutable/test/${i}.js?status=200`);
		}
		await fetch('/_app/immutable/test/5.js?status=503');
	});
	await appendFailingStylesheet(page);

	await expect
		.poll(async () => (await sentDiagnostics(page)).map(({ body }) => body.type))
		.toEqual(['stylesheet-load-error']);

	const [{ body }] = await sentDiagnostics(page);
	expect(body.javascriptResources).toEqual([
		...[4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19].map((i) => ({
			path: `/_app/immutable/test/${i}.js`,
			initiatorType: 'fetch',
			responseStatus: 200
		})),
		{ path: '/_app/immutable/test/5.js', initiatorType: 'fetch', responseStatus: 503 }
	]);
});
