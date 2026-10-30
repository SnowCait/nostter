import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('button', { name: 'Login', exact: true })).toBeVisible();
});

test.afterEach(async ({ page }, testInfo) => {
	if (testInfo.status !== 'passed') {
		return;
	}
	const path = testInfo.outputPath(
		'ui-screenshots',
		`${testInfo.project.name}-${testInfo.title}.png`
	);
	await page.screenshot({ path, fullPage: false, animations: 'disabled' });
});

test('anonymous-top-page', async ({ page }) => {
	await expect(page).toHaveTitle('nostter');
	await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('login-dialog', async ({ page }) => {
	await page.getByRole('button', { name: 'Login', exact: true }).click();
	await expect(page.getByRole('dialog')).toBeVisible();
	await expect(page.getByPlaceholder('bunker://...')).toBeVisible();
});

test('login-failure', async ({ page }) => {
	await page.getByRole('button', { name: 'Login', exact: true }).click();
	const dialog = page.getByRole('dialog');
	await dialog.getByPlaceholder('bunker://...').fill('invalid-bunker');
	await dialog.getByRole('button', { name: 'Login with Bunker' }).click();
	await expect(dialog.getByText('Failed to login.', { exact: true })).toBeVisible();
	await expect(dialog.getByRole('button', { name: 'Login with Bunker' })).toBeEnabled();
});
