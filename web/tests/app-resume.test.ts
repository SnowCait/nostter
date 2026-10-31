import { expect, test, type Page } from '@playwright/test';
import { generateSecretKey, getPublicKey, nip19, type Filter } from 'nostr-tools';
import { e2eRelayUrl } from './e2e-relay-url';
import { expectLoggedInHome, publishFollowList } from './login-helpers';

const hiddenAt = 1_900_000_000;
const visibleAt = hiddenAt + 60;

type Request = { id: string; filters: Filter[] };

async function prepareHome(page: Page) {
	const requests: Request[] = [];
	const closed = new Set<string>();
	page.on('websocket', (socket) => {
		if (new URL(socket.url()).href !== e2eRelayUrl) {
			return;
		}
		socket.on('framesent', ({ payload }) => {
			const [type, id, ...filters] = JSON.parse(payload.toString());
			if (type === 'REQ') {
				requests.push({ id, filters });
			}
			if (type === 'CLOSE') {
				closed.add(id);
			}
		});
	});
	const key = generateSecretKey();
	const pubkey = getPublicKey(key);
	const followee = getPublicKey(generateSecretKey());
	await publishFollowList(key, [followee]);
	await page.goto('/');
	await page.getByRole('button', { name: 'Login', exact: true }).click();
	const dialog = page.getByRole('dialog');
	await dialog.getByPlaceholder('npub or nsec').fill(nip19.npubEncode(pubkey));
	await dialog.getByRole('button', { name: 'Login with key' }).click();
	await expectLoggedInHome(page, pubkey);
	const follows = (filter: Filter) =>
		filter.authors?.includes(followee) && filter.kinds?.includes(1);
	await expect
		.poll(() =>
			requests.some((req) =>
				req.filters.some(
					(f) => follows(f) && f.since !== undefined && f.until === undefined
				)
			)
		)
		.toBe(true);
	await expect
		.poll(() =>
			requests.some(
				(req) =>
					closed.has(req.id) &&
					req.filters.some((f) => follows(f) && f.until !== undefined)
			)
		)
		.toBe(true);
	await page.clock.install();
	await page.clock.setFixedTime(hiddenAt * 1000);
	const backfills = () =>
		requests.filter((req) =>
			req.filters.some((f) => follows(f) && f.since === hiddenAt && f.until === visibleAt)
		);
	const boundedRequests = () =>
		requests.filter((req) =>
			req.filters.some(
				(f) =>
					follows(f) &&
					f.since !== undefined &&
					f.since >= hiddenAt &&
					f.until !== undefined
			)
		);
	return { backfills, boundedRequests, closed };
}

async function expectBackfill(page: Page, state: Awaited<ReturnType<typeof prepareHome>>) {
	await expect.poll(() => state.backfills().length).toBe(1);
	await expect.poll(() => state.closed.has(state.backfills()[0].id)).toBe(true);
	// Drain scheduled request batching before checking for duplicate subscriptions.
	await page.clock.runFor(1000);
	expect(state.backfills()).toHaveLength(1);
	expect(state.boundedRequests()).toHaveLength(1);
}

async function visibility(page: Page, value: DocumentVisibilityState) {
	// Headless tab activation does not reliably change visibility. Exercise the event path explicitly.
	await page.evaluate((state) => {
		Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
		document.dispatchEvent(new Event('visibilitychange'));
	}, value);
}

test('visibility event path does not backfill when no time has elapsed', async ({ page }) => {
	const state = await prepareHome(page);
	await visibility(page, 'hidden');
	await visibility(page, 'visible');
	await page.clock.runFor(1000);
	expect(state.boundedRequests()).toHaveLength(0);
});

test('CDP freeze/resume backfills without visibilitychange', async ({ page, browserName }) => {
	test.skip(browserName !== 'chromium', 'Page.setWebLifecycleState requires Chromium CDP');
	const state = await prepareHome(page);
	await page.evaluate(() => {
		for (const type of ['freeze', 'resume', 'visibilitychange']) {
			document.addEventListener(type, (event) => {
				document.documentElement.setAttribute(`data-test-${type}`, String(event.isTrusted));
			});
		}
	});
	const cdp = await page.context().newCDPSession(page);
	try {
		await cdp.send('Page.setWebLifecycleState', { state: 'frozen' });
		await expect(page.locator('html')).toHaveAttribute('data-test-freeze', 'true');
		await page.clock.setFixedTime(visibleAt * 1000);
		await cdp.send('Page.setWebLifecycleState', { state: 'active' });
		await expect(page.locator('html')).toHaveAttribute('data-test-resume', 'true');
		await expectBackfill(page, state);
		expect(await page.locator('html').getAttribute('data-test-visibilitychange')).toBeNull();
	} finally {
		await cdp.send('Page.setWebLifecycleState', { state: 'active' });
		await cdp.detach();
	}
});

test('visibility event path backfills after less than 300 seconds', async ({ page }) => {
	const state = await prepareHome(page);
	await visibility(page, 'hidden');
	await page.clock.setFixedTime(visibleAt * 1000);
	await visibility(page, 'visible');
	await expectBackfill(page, state);
});

test('persisted page transition event path backfills (simulated, not a bfcache restore)', async ({
	page
}) => {
	const state = await prepareHome(page);
	await page.evaluate(() =>
		window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }))
	);
	await page.clock.setFixedTime(visibleAt * 1000);
	await page.evaluate(() =>
		window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))
	);
	await expectBackfill(page, state);
});

test('consecutive resume events consume the hidden interval only once', async ({ page }) => {
	const state = await prepareHome(page);
	await visibility(page, 'hidden');
	await page.clock.setFixedTime(visibleAt * 1000);
	await page.evaluate(() => {
		document.dispatchEvent(new Event('resume'));
		window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
		document.dispatchEvent(new Event('resume'));
	});
	await visibility(page, 'visible');
	await expectBackfill(page, state);
});
