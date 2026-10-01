import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { kinds, nip19, Relay, type NostrEvent } from 'nostr-tools';
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
	// A REQ returns the events already stored and stays open for the ones stored later.
	const relay = await Relay.connect(e2eRelayUrl);
	let deadline: ReturnType<typeof setTimeout> | undefined;
	try {
		const { metadata, relayList } = await new Promise<{
			metadata: NostrEvent;
			relayList: NostrEvent;
		}>((resolve, reject) => {
			let metadata: NostrEvent | undefined;
			let relayList: NostrEvent | undefined;
			const received = () =>
				`kind 0: ${metadata !== undefined}, kind 10002: ${relayList !== undefined}`;
			deadline = setTimeout(
				() => reject(new Error(`Timed out waiting for events (${received()})`)),
				10_000
			);
			relay.subscribe([{ kinds: [kinds.Metadata, kinds.RelayList], authors: [pubkey] }], {
				onevent(event) {
					if (event.kind === kinds.Metadata) {
						metadata = event;
					} else if (event.kind === kinds.RelayList) {
						relayList = event;
					}
					if (metadata !== undefined && relayList !== undefined) {
						resolve({ metadata, relayList });
					}
				},
				onclose(reason) {
					reject(new Error(`Subscription closed: ${reason} (${received()})`));
				}
			});
		});

		expect(JSON.parse(metadata.content)).toMatchObject({ name, display_name: name });
		// An r tag without a marker means the relay is used for both reading and writing.
		expect(relayList.tags).toContainEqual(['r', e2eRelayUrl]);
	} finally {
		clearTimeout(deadline);
		relay.close();
	}
});
