import { expect, test, type BrowserContext } from '@playwright/test';
import { finalizeEvent, generateSecretKey, getPublicKey, type EventTemplate } from 'nostr-tools';
import { expectLoggedInHome, expectSigningSession, publishFollowList } from './login-helpers';

// Emulates a NIP-07 extension. The secret key stays in the test process:
// the page only gets the pubkey and a signEvent() exposed from here.
async function installNip07Extension(context: BrowserContext, secretKey: Uint8Array) {
	await context.addInitScript(
		({ pubkey, signEvent }) => {
			Object.assign(window, {
				nostr: {
					getPublicKey: async () => pubkey,
					signEvent
				}
			});
		},
		{
			pubkey: getPublicKey(secretKey),
			signEvent: async ({ kind, tags, content, created_at }: EventTemplate) =>
				finalizeEvent({ kind, tags, content, created_at }, secretKey)
		},
		{ exposeFunctions: true }
	);
}

test('logs in with a NIP-07 extension and restores the login on startup', async ({
	context,
	page
}) => {
	const secretKey = generateSecretKey();
	const pubkey = getPublicKey(secretKey);

	// A non-empty follow list makes the app land on /home instead of /public.
	await publishFollowList(secretKey, [getPublicKey(generateSecretKey())]);
	await installNip07Extension(context, secretKey);

	await test.step('log in with the browser extension from the login dialog', async () => {
		await page.goto('/');
		await page.getByRole('button', { name: 'Login', exact: true }).click();
		const loginWithExtension = page
			.getByRole('dialog')
			.getByRole('button', { name: 'Login with Browser Extension' });
		// The button stays disabled until nip07-awaiter detects window.nostr.
		await expect(loginWithExtension).toBeEnabled();
		await loginWithExtension.click();

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
