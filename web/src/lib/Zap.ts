import { MetricsWebSocket } from '$lib/platform/browser/websocket-metrics';
import { nip04 } from 'nostr-tools';
import { createRxForwardReq, createRxNostr, noopSigner } from 'rx-nostr';
import { seckeySigner } from '@rx-nostr/crypto';
import { Subscription } from 'rxjs';
import type * as Nostr from 'nostr-typedef';
import { makeNwcRequestEvent, parseConnectionString } from '$lib/nostr-tools/nip47';
import { parsePayInvoiceResponse, type NwcPaymentResult } from '$lib/nostr/protocol/nip47';
import { verificationClient } from './timelines/MainTimeline';
import { hexToBytes } from 'nostr-tools/utils';

export async function zapWithWalletConnect(
	uri: string,
	invoice: string
): Promise<NwcPaymentResult> {
	let connection;
	let event;
	let nwcRxNostr;
	try {
		connection = parseConnectionString(uri);
		event = await makeNwcRequestEvent(
			connection.pubkey,
			hexToBytes(connection.secret),
			invoice
		);
		nwcRxNostr = createRxNostr({
			websocketCtor: MetricsWebSocket,
			verifier: verificationClient.verifier,
			signer: noopSigner(),
			authenticator: { signer: seckeySigner(connection.secret) }
		});
	} catch (error) {
		return { status: 'failed', message: error instanceof Error ? error.message : '' };
	}
	const { pubkey: walletPubkey, relay: walletRelay, secret: walletSeckey } = connection;
	const subscriptions = new Subscription();
	let timeout: ReturnType<typeof setTimeout> | undefined;

	try {
		nwcRxNostr.setDefaultRelays([walletRelay]);
		const { promise, resolve } = Promise.withResolvers<Nostr.Event | null>();
		timeout = setTimeout(() => resolve(null), 10000);
		const nwcRxReq = createRxForwardReq();
		subscriptions.add(
			nwcRxNostr.use(nwcRxReq).subscribe({
				next: ({ event: response }) => resolve(response),
				complete: () => resolve(null),
				error: () => resolve(null)
			})
		);
		nwcRxReq.emit([{ kinds: [23195], authors: [walletPubkey], '#e': [event.id] }]);
		subscriptions.add(
			nwcRxNostr.send(event).subscribe({
				next: (packet) => {
					if (!packet.ok) {
						resolve(null);
					}
				},
				error: () => resolve(null)
			})
		);

		const walletEvent = await promise;
		if (walletEvent === null) {
			return { status: 'unknown', reason: 'transport' };
		}

		try {
			const json = await nip04.decrypt(walletSeckey, walletPubkey, walletEvent.content);
			return parsePayInvoiceResponse(JSON.parse(json));
		} catch {
			return { status: 'unknown', reason: 'invalid-response' };
		}
	} catch {
		return { status: 'unknown', reason: 'transport' };
	} finally {
		clearTimeout(timeout);
		subscriptions.unsubscribe();
		nwcRxNostr.dispose();
	}
}
