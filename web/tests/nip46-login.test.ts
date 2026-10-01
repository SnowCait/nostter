import { test } from '@playwright/test';
import {
	finalizeEvent,
	generateSecretKey,
	getPublicKey,
	kinds,
	nip44,
	Relay,
	type EventTemplate,
	type NostrEvent
} from 'nostr-tools';
import { toBunkerURL } from 'nostr-tools/nip46';
import { e2eRelayUrl } from './e2e-relay-url';
import { expectLoggedInHome, expectSigningSession, publishFollowList } from './login-helpers';

type Nip46Request = { id: string; method: string; params: string[] };
type Nip46Outcome = { result: string; error?: string };

// A minimal NIP-46 remote signer running in the test process.
// It talks to the app only through kind 24133 events on the E2E relay.
async function startTestBunker(
	remoteSignerSecretKey: Uint8Array,
	userSecretKey: Uint8Array
): Promise<() => void> {
	const remoteSignerPubkey = getPublicKey(remoteSignerSecretKey);
	// Policy of this test bunker, not a NIP-46 requirement: only the client that connected first is
	// served, so restoring the login succeeds only if the app reuses its saved client key.
	let authorizedClientPubkey: string | undefined;

	const handle = (clientPubkey: string, { method, params }: Nip46Request): Nip46Outcome => {
		if (method === 'connect') {
			if (params[0] !== remoteSignerPubkey) {
				return { result: '', error: 'connect is not addressed to this remote signer' };
			}
			authorizedClientPubkey ??= clientPubkey;
			if (clientPubkey !== authorizedClientPubkey) {
				return { result: '', error: 'unknown client' };
			}
			return { result: 'ack' };
		}
		if (clientPubkey !== authorizedClientPubkey) {
			return { result: '', error: 'not connected' };
		}
		switch (method) {
			case 'get_public_key':
				return { result: getPublicKey(userSecretKey) };
			case 'sign_event': {
				const { kind, tags, content, created_at }: EventTemplate = JSON.parse(params[0]);
				return {
					result: JSON.stringify(
						finalizeEvent({ kind, tags, content, created_at }, userSecretKey)
					)
				};
			}
			default:
				return { result: '', error: `unsupported method: ${method}` };
		}
	};

	const relay = await Relay.connect(e2eRelayUrl);
	const respond = async (requestEvent: NostrEvent): Promise<void> => {
		const clientPubkey = requestEvent.pubkey;
		const conversationKey = nip44.getConversationKey(remoteSignerSecretKey, clientPubkey);
		const request: Nip46Request = JSON.parse(
			nip44.decrypt(requestEvent.content, conversationKey)
		);
		const response = { id: request.id, ...handle(clientPubkey, request) };
		await relay.publish(
			finalizeEvent(
				{
					kind: kinds.NostrConnect,
					created_at: Math.floor(Date.now() / 1000),
					tags: [['p', clientPubkey]],
					content: nip44.encrypt(JSON.stringify(response), conversationKey)
				},
				remoteSignerSecretKey
			)
		);
	};

	// Requests are ephemeral and never stored by the relay,
	// so the subscription must be live before the app sends them.
	const { promise: subscribed, resolve, reject } = Promise.withResolvers<void>();
	try {
		relay.subscribe([{ kinds: [kinds.NostrConnect], '#p': [remoteSignerPubkey] }], {
			onevent(requestEvent) {
				respond(requestEvent).catch((error) => console.error('[test bunker]', error));
			},
			oneose: resolve,
			onclose: (reason) => reject(new Error(`Test bunker subscription closed: ${reason}`))
		});
		await subscribed;
	} catch (error) {
		relay.close();
		throw error;
	}

	// Closing the relay also closes the subscription.
	return () => relay.close();
}

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
