import { test } from '@playwright/test';
import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';
import { expectLoggedInHome, expectSigningSession, publishFollowList } from './login-helpers';

test('logs in with nsec and restores the signing session on startup', async ({ context, page }) => {
	const secretKey = generateSecretKey();
	const pubkey = getPublicKey(secretKey);
	const nsec = nip19.nsecEncode(secretKey);

	// A non-empty follow list makes the app land on /home instead of /public.
	await publishFollowList(secretKey, [getPublicKey(generateSecretKey())]);

	await test.step('log in with nsec from the login dialog', async () => {
		await page.goto('/');
		await page.getByRole('button', { name: 'Login', exact: true }).click();
		const dialog = page.getByRole('dialog');
		await dialog.getByPlaceholder('npub or nsec').fill(nsec);
		await dialog.getByRole('button', { name: 'Login with key' }).click();

		await expectLoggedInHome(page, pubkey);
		await expectSigningSession(page);
	});

	await test.step('restore the saved login on startup', async () => {
		await page.close();
		const restartedPage = await context.newPage();
		await restartedPage.goto('/');

		await expectLoggedInHome(restartedPage, pubkey);
		await expectSigningSession(restartedPage);
	});
});
