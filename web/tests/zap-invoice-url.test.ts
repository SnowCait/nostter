import { expect, test } from '@playwright/test';
import { finalizeEvent, generateSecretKey, getPublicKey, kinds, nip19, Relay } from 'nostr-tools';
import { e2eRelayUrl } from './e2e-relay-url';

const cases = [
	{ query: '', expected: '' },
	{ query: '?foo=bar&foo=baz', expected: 'foo=bar&foo=baz' },
	{ query: '?value=a%20b%2Bc%26d&tilde=%7e', expected: 'value=a%20b%2Bc%26d&tilde=%7e' },
	{ query: '?amount=9&nostr=old&foo=bar&amount=10', expected: 'foo=bar' }
];

for (const { query, expected } of cases) {
	test(`invoice callback preserves existing parameters: ${query || '(none)'}`, async ({
		page
	}) => {
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
					callback: `https://example.com/invoice${query}`
				},
				headers: { 'access-control-allow-origin': '*' }
			})
		);
		let requested = '';
		await page.route('https://example.com/invoice**', (route) => {
			requested = route.request().url();
			return route.fulfill({
				json: { pr: 'test-invoice' },
				headers: { 'access-control-allow-origin': '*' }
			});
		});
		await page.goto('/');
		await page.getByRole('button', { name: 'Login', exact: true }).click();
		const login = page.getByRole('dialog');
		await login.getByPlaceholder('npub or nsec').fill(nip19.nsecEncode(signer));
		await login.getByRole('button', { name: 'Login with key' }).click();
		await expect(
			page.getByRole('banner').getByRole('button', { name: 'Post', exact: true })
		).toBeVisible();
		await page.goto(`/${nip19.npubEncode(pubkey)}`);
		const zapButton = page.locator('.user-info .zap > button');
		await expect(zapButton).toBeEnabled();
		await zapButton.click();
		const dialog = page.getByRole('dialog');
		const comment = 'a & b = c ? # + % / 日本語';
		await dialog.getByPlaceholder('Message (optional)').fill(comment);
		await dialog.getByRole('button', { name: 'Zap', exact: true }).click();
		await expect(dialog.locator('.lnbc .text')).toHaveText('test-invoice');
		const url = new URL(requested);
		expect(url.searchParams.getAll('amount')).toEqual(['1000']);
		expect(url.searchParams.getAll('nostr')).toHaveLength(1);
		expect(JSON.parse(url.searchParams.get('nostr')!).content).toBe(comment);
		expect(url.search.startsWith(expected ? `?${expected}&` : '?amount=')).toBe(true);
	});
}
