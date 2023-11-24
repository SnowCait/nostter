import { expect, test } from '@playwright/test';

test('index page has expected logo', async ({ page }) => {
	await page.goto('/');
	await expect(page).toHaveTitle('nostter');
});
