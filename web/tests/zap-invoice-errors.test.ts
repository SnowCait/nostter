import { expect, test } from '@playwright/test';
import { finalizeEvent, generateSecretKey, getPublicKey, kinds, nip19, Relay } from 'nostr-tools';
import { e2eRelayUrl } from './e2e-relay-url';

test('shows and copies invoice errors and clears details on retry', async ({ page, context }) => {
	const signer = generateSecretKey();
	const recipient = generateSecretKey();
	const pubkey = getPublicKey(recipient);
	const relay = await Relay.connect(e2eRelayUrl);
	try {
		await relay.publish(
			finalizeEvent(
				{
					kind: kinds.Metadata,
					created_at: Math.floor(Date.now() / 1000),
					tags: [],
					content: JSON.stringify({ name: 'Zap test', lud16: 'test@example.com' })
				},
				recipient
			)
		);
	} finally {
		relay.close();
	}

	await page.route('https://example.com/.well-known/lnurlp/test', (route) =>
		route.fulfill({
			json: {
				allowsNostr: true,
				nostrPubkey: pubkey,
				callback: 'https://example.com/invoice?service=zap'
			},
			headers: { 'access-control-allow-origin': '*' }
		})
	);
	let attempt = 0;
	await page.route('https://example.com/invoice**', (route) => {
		const responses = [
			{ status: 503, body: '<html>service unavailable</html>', contentType: 'text/html' },
			{ status: 200, body: '{broken json', contentType: 'application/json' },
			{ status: 200, body: '{"unexpected":"response"}', contentType: 'application/json' },
			{ status: 200, body: '{"pr":"test-invoice"}', contentType: 'application/json' }
		];
		return route.fulfill({
			...responses[attempt++],
			headers: { 'access-control-allow-origin': '*' }
		});
	});
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await page.goto('/');
	await page.getByRole('button', { name: 'Login', exact: true }).click();
	const login = page.getByRole('dialog');
	await login.getByPlaceholder('npub or nsec').fill(nip19.nsecEncode(signer));
	await login.getByRole('button', { name: 'Login with key' }).click();
	await expect(
		page.getByRole('banner').getByRole('button', { name: 'Post', exact: true })
	).toBeVisible({ timeout: 20000 });
	await page.goto(`/${nip19.npubEncode(pubkey)}`);
	const zapButton = page.locator('.user-info .zap > button');
	await expect(zapButton).toBeEnabled();
	await zapButton.click();
	const dialog = page.getByRole('dialog');
	const send = dialog.getByRole('button', { name: 'Zap', exact: true });
	await send.click();
	const details = dialog.locator('details');
	await expect(details).toBeVisible();
	await details.locator('summary').click();
	const text = details.locator('pre');
	await expect(text).toContainText('HTTP status: 503');
	await expect(text).toContainText('<html>service unavailable</html>');
	await expect(text).toContainText('Callback URL: https://example.com/invoice?service=zap');
	await details.getByRole('button', { name: 'Copy details' }).click();
	await expect
		.poll(() => page.evaluate(() => navigator.clipboard.readText()))
		.toBe(await text.textContent());
	await send.click();
	await details.locator('summary').click();
	await expect(text).toContainText('{broken json');
	await expect(text).not.toContainText('service unavailable');
	await send.click();
	await details.locator('summary').click();
	await expect(text).toContainText('{"unexpected":"response"}');
	await expect(text).not.toContainText('{broken json');
	await send.click();
	await expect(dialog.locator('.lnbc .text')).toHaveText('test-invoice');
	await expect(details).toHaveCount(0);
});
