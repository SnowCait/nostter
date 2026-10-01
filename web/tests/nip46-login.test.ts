import { test } from '@playwright/test';
import { generateSecretKey, getPublicKey } from 'nostr-tools';
import { toBunkerURL } from 'nostr-tools/nip46';
import { e2eRelayUrl } from './e2e-relay-url';
import { expectLoggedInHome, expectSigningSession, publishFollowList } from './login-helpers';
import { startTestBunker } from './nip46-test-bunker';

test('logs in with a NIP-46 bunker and restores the login on startup', async ({
	context,
	page
}) => {
	// The remote signer and the user have different keys, so the app has to get the
	// account pubkey from get_public_key instead of taking it from the bunker URL.
	const remoteSignerSecretKey = generateSecretKey();
	const userSecretKey = generateSecretKey();
	const userPubkey = getPublicKey(userSecretKey);
	const bunkerUrl = toBunkerURL({
		pubkey: getPublicKey(remoteSignerSecretKey),
		relays: [e2eRelayUrl],
		secret: null
	});

	// A non-empty follow list makes the app land on /home instead of /public.
	await publishFollowList(userSecretKey, [getPublicKey(generateSecretKey())]);

	const stopTestBunker = await startTestBunker(remoteSignerSecretKey, userSecretKey);
	try {
		await test.step('log in with the bunker URL from the login dialog', async () => {
			await page.goto('/');
			await page.getByRole('button', { name: 'Login', exact: true }).click();
			const dialog = page.getByRole('dialog');
			await dialog.getByPlaceholder('bunker://...').fill(bunkerUrl);
			await dialog.getByRole('button', { name: 'Login with Bunker' }).click();

			await expectLoggedInHome(page, userPubkey);
			await expectSigningSession(page);
		});

		await test.step('restore the saved login on startup', async () => {
			await page.close();
			const restartedPage = await context.newPage();
			await restartedPage.goto('/');

			await expectLoggedInHome(restartedPage, userPubkey);
			await expectSigningSession(restartedPage);
		});
	} finally {
		stopTestBunker();
	}
});
