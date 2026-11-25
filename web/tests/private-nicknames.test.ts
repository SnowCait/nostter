import { expect, test } from '@playwright/test';
import { finalizeEvent, generateSecretKey, getPublicKey, kinds, nip19, Relay } from 'nostr-tools';
import { e2eRelayUrl } from './e2e-relay-url';

test('private nicknames update across displays and survive clearing the event cache', async ({
	page,
	context
}) => {
	await context.route('https://**/*', (route) => route.abort());
	const secretKey = generateSecretKey();
	const metadata = finalizeEvent(
		{
			kind: kinds.Metadata,
			created_at: Math.floor(Date.now() / 1000),
			tags: [],
			content: JSON.stringify({ name: 'public-handle', display_name: 'Public Name' })
		},
		secretKey
	);
	const relay = await Relay.connect(e2eRelayUrl);
	try {
		await relay.publish(metadata);
		await relay.publish(
			finalizeEvent(
				{
					kind: kinds.ShortTextNote,
					created_at: metadata.created_at - 1,
					tags: [],
					content: 'A post by the public profile'
				},
				secretKey
			)
		);
	} finally {
		relay.close();
	}

	const profilePath = '/' + nip19.npubEncode(metadata.pubkey);
	await page.goto(profilePath);
	const heading = page.getByRole('heading', { level: 1 });
	await expect(heading).toHaveText('Public Name');
	const publicTitle = await page.title();
	const openGraphTitle = page.locator('meta[property="og:title"]');
	const publicOpenGraphTitle = await openGraphTitle.getAttribute('content');
	const post = page.locator('article').filter({ hasText: 'A post by the public profile' });
	await expect(post.getByText('Public Name', { exact: true })).toBeVisible();

	// The relay page is another name display and remains mounted while the profile is edited.
	const relayPage = await context.newPage();
	await relayPage.goto(profilePath + '/relays');
	await expect(relayPage.getByRole('heading', { level: 1 })).toContainText('Public Name');

	await page.getByRole('button', { name: 'Profile menu' }).click();
	await page.getByRole('menuitem', { name: 'Set nickname' }).click();
	const dialog = page.getByRole('dialog', { name: 'Set nickname' });
	await dialog.getByRole('textbox', { name: 'Nickname' }).fill('First nickname');
	await dialog.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(heading).toContainText('First nickname');
	await expect(page.getByText('Public Name', { exact: true })).toBeVisible();
	await expect(post.getByText('First nickname', { exact: true })).toBeVisible();
	await expect(relayPage.getByRole('heading', { level: 1 })).toContainText('First nickname');
	await expect(openGraphTitle).toHaveAttribute('content', publicOpenGraphTitle ?? '');
	await expect(page).toHaveTitle(publicTitle);

	await heading.getByRole('button', { name: 'Edit nickname' }).click();
	const editor = page.getByRole('dialog', { name: 'Edit nickname' });
	await expect(editor.getByRole('textbox', { name: 'Nickname' })).toHaveValue('First nickname');
	await editor.getByRole('textbox', { name: 'Nickname' }).fill('Updated nickname');
	await editor.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(heading).toContainText('Updated nickname');

	await page.goto('/preferences');
	await page.getByRole('checkbox', { name: /developer mode/i }).check();
	await page.getByRole('button', { name: 'Clear event cache and reload' }).click();
	await expect(page).not.toHaveURL('/preferences');
	await page.goto(profilePath);
	await expect(heading).toContainText('Updated nickname');

	await page.getByRole('button', { name: 'Profile menu' }).click();
	await page.getByRole('menuitem', { name: 'Edit nickname' }).click();
	await editor.getByRole('button', { name: 'Delete nickname' }).click();
	await expect(heading).toHaveText('Public Name');
	await expect(relayPage.getByRole('heading', { level: 1 })).toContainText('Public Name');
	await expect(post.getByText('Public Name', { exact: true })).toBeVisible();
	await page.reload();
	await expect(heading).toHaveText('Public Name');
});

test('waits for saved nicknames before offering to edit them', async ({ page, context }) => {
	await context.route('https://**/*', (route) => route.abort());
	const npub = nip19.npubEncode(getPublicKey(generateSecretKey()));
	await page.goto('/' + npub);

	const menu = page.getByRole('button', { name: 'Profile menu' });
	await menu.click();
	await page.getByRole('menuitem', { name: 'Set nickname' }).click();
	const dialog = page.getByRole('dialog');
	await dialog.getByRole('textbox', { name: 'Nickname' }).fill('Saved nickname');
	await dialog.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Saved nickname');

	await page.addInitScript(() => {
		const open = IDBFactory.prototype.open;
		IDBFactory.prototype.open = function (name, version) {
			const request = open.call(this, name, version);
			if (name === 'private-nicknames') {
				// Hold Dexie's open notification until the test checks the menu.
				request.addEventListener(
					'success',
					(event) => {
						event.stopImmediatePropagation();
						window.addEventListener(
							'release-nickname-open',
							() => request.dispatchEvent(new Event('success')),
							{ once: true }
						);
						document.documentElement.dataset.nicknameOpenHeld = 'true';
					},
					{ once: true }
				);
			}
			return request;
		};
	});

	await page.reload();
	await expect(page.locator('html')).toHaveAttribute('data-nickname-open-held', 'true');
	await menu.click();
	await expect(page.getByRole('menuitem', { name: 'Copy ID (npub)' })).toBeVisible();
	await expect(page.getByRole('menuitem', { name: /^(Set|Edit) nickname$/ })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Edit nickname' })).toHaveCount(0);
	await expect(dialog).toHaveCount(0);

	await page.evaluate(() => window.dispatchEvent(new Event('release-nickname-open')));
	await page.getByRole('menuitem', { name: 'Edit nickname' }).click();
	await expect(dialog.getByRole('textbox', { name: 'Nickname' })).toHaveValue('Saved nickname');
});
