import { expect, test, type Page } from '@playwright/test';
import { finalizeEvent, generateSecretKey, getPublicKey, kinds, nip19, Relay } from 'nostr-tools';
import { e2eRelayUrl } from './e2e-relay-url';

async function publishFollowList(secretKey: Uint8Array, followees: string[]): Promise<void> {
	const relay = await Relay.connect(e2eRelayUrl);
	try {
		await relay.publish(
			finalizeEvent(
				{
					kind: kinds.Contacts,
					created_at: Math.floor(Date.now() / 1000),
					tags: followees.map((pubkey) => ['p', pubkey]),
					content: ''
				},
				secretKey
			)
		);
	} finally {
		relay.close();
	}
}

test('logs in with npub and restores the login on startup', async ({ context, page }) => {
	const secretKey = generateSecretKey();
	const pubkey = getPublicKey(secretKey);
	const npub = nip19.npubEncode(pubkey);

	// A non-empty follow list makes the app land on /home instead of /public.
	await publishFollowList(secretKey, [getPublicKey(generateSecretKey())]);

	const expectLoggedInHome = async (page: Page) => {
		await expect(page).toHaveURL('/home');
		await expect(
			page.getByRole('navigation').getByRole('link', { name: 'Profile' })
		).toHaveAttribute('href', `/${nip19.nprofileEncode({ pubkey })}`);
	};

	await test.step('log in with npub from the login dialog', async () => {
		await page.goto('/');
		await page.getByRole('button', { name: 'Login', exact: true }).click();
		const dialog = page.getByRole('dialog');
		await dialog.getByPlaceholder('npub or nsec').fill(npub);
		await dialog.getByRole('button', { name: 'Login with key' }).click();

		await expectLoggedInHome(page);
	});

	await test.step('restore the saved login on startup', async () => {
		await page.close();
		const restartedPage = await context.newPage();
		await restartedPage.goto('/');

		await expectLoggedInHome(restartedPage);
	});
});
