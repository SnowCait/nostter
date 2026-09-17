import { expect, test } from '@playwright/test';

test('index page has expected title', async ({ page }) => {
	await page.goto('/');
	await expect(page).toHaveTitle('nostter');
});

test('desktop navigation retains its top spacing during short page navigation', async ({
	page
}) => {
	await page.setViewportSize({ width: 1200, height: 800 });
	await page.goto('/about');

	const expectLogoTop = async () => {
		await expect
			.poll(async () =>
				Math.round((await page.locator('#logo-icon-wrapper').boundingBox())?.y ?? -1)
			)
			.toBe(8);
	};

	await expectLogoTop();
	await page.locator('.app > header a[href="/public"]').click();
	await page.waitForURL('**/public');
	await expectLogoTop();
	await page.locator('.app > header a[href="/about"]').click();
	await page.waitForURL('**/about');
	await expectLogoTop();
});
