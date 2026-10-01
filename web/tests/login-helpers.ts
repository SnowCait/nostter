import { expect, type Page } from '@playwright/test';
import { finalizeEvent, kinds, nip19, Relay } from 'nostr-tools';
import { e2eRelayUrl } from './e2e-relay-url';

export async function publishFollowList(secretKey: Uint8Array, followees: string[]): Promise<void> {
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

export async function expectLoggedInHome(page: Page, pubkey: string): Promise<void> {
	await expect(page).toHaveURL('/home');
	await expect(
		page.getByRole('navigation').getByRole('link', { name: 'Profile' })
	).toHaveAttribute('href', `/${nip19.nprofileEncode({ pubkey })}`);
}

// The header shows the Post button only while a signer is available.
export async function expectSigningSession(page: Page): Promise<void> {
	await expect(
		page.getByRole('banner').getByRole('button', { name: 'Post', exact: true })
	).toBeVisible();
}
