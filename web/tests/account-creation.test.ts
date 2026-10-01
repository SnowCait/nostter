import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { kinds, nip19, SimplePool } from 'nostr-tools';
import { e2eRelayUrl } from './e2e-relay-url';
import { expectSigningSession } from './login-helpers';

test('creates an account and publishes its metadata and relay list', async ({ page }) => {
	const name = `e2e-${randomUUID()}`;

	await page.goto('/');
	await page.getByRole('button', { name: 'Create account', exact: true }).click();
	const dialog = page.getByRole('dialog');
	await expect(dialog.getByRole('heading', { name: 'Create account' })).toBeVisible();
	await dialog.getByPlaceholder('name').fill(name);
	await dialog.getByRole('button', { name: 'Create', exact: true }).click();

	await expect(page).toHaveURL('/public');
	await expectSigningSession(page);

	// The secret key is generated in the browser, so the created account is identified by the Profile link.
	const profileLink = page.getByRole('navigation').getByRole('link', { name: 'Profile' });
	await expect(profileLink).toHaveAttribute('href', /^\/nprofile1/);
	const profile = nip19.decode((await profileLink.getAttribute('href'))?.slice(1) ?? '');
	if (profile.type !== 'nprofile') {
		throw new Error(`Unexpected Profile link: ${profile.type}`);
	}
	const { pubkey } = profile.data;

	// Account creation navigates without waiting for the relay to accept the events.
	const pool = new SimplePool();
	try {
		await expect
			.poll(async () => {
				const event = await pool.get([e2eRelayUrl], {
					kinds: [kinds.Metadata],
					authors: [pubkey]
				});
				return event && JSON.parse(event.content);
			})
			.toMatchObject({ name, display_name: name });

		// An r tag without a marker means the relay is used for both reading and writing.
		await expect
			.poll(async () => {
				const event = await pool.get([e2eRelayUrl], {
					kinds: [kinds.RelayList],
					authors: [pubkey]
				});
				return event?.tags;
			})
			.toContainEqual(['r', e2eRelayUrl]);
	} finally {
		pool.destroy();
	}
});
