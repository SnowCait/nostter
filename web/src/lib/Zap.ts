import { MetricsWebSocket } from '$lib/platform/browser/websocket-metrics';
import { nip04 } from 'nostr-tools';
import { createRxForwardReq, createRxNostr, noopSigner } from 'rx-nostr';
import { EMPTY, take, timeout } from 'rxjs';
import { seckeySigner } from '@rx-nostr/crypto';
import type * as Nostr from 'nostr-typedef';
import { makeNwcRequestEvent, parseConnectionString } from '$lib/nostr-tools/nip47';
import { verificationClient } from './timelines/MainTimeline';
import { hexToBytes } from 'nostr-tools/utils';
import { parsePayInvoiceResponse } from '@nostter/nostr-protocol';

export type NwcPaymentResult =
	{ status: 'success' } | { status: 'failed'; message?: string } | { status: 'unknown' };

export async function zapWithWalletConnect(
	uri: string,
	invoice: string
): Promise<NwcPaymentResult> {
	let nwcRxNostr: ReturnType<typeof createRxNostr> | undefined;
	let submitted = false;
	const requestRejected = new Error('NWC request rejected');
	try {
		const {
			pubkey: walletPubkey,
			relay: walletRelay,
			secret: walletSeckey
		} = parseConnectionString(uri);
		console.debug('[NWC info]', walletRelay, walletPubkey);
		const event = await makeNwcRequestEvent(walletPubkey, hexToBytes(walletSeckey), invoice);
		console.debug('[NWC event]', event);

		nwcRxNostr = createRxNostr({
			websocketCtor: MetricsWebSocket,
			verifier: verificationClient.verifier,
			signer: noopSigner(),
			authenticator: {
				signer: seckeySigner(walletSeckey)
			}
		});

		const { promise, resolve, reject } = Promise.withResolvers<Nostr.Event | null>();
		nwcRxNostr.setDefaultRelays([walletRelay]);

		const nwcRxReq = createRxForwardReq();
		nwcRxNostr
			.use(nwcRxReq)
			.pipe(take(1), timeout({ first: 10_000, with: () => EMPTY }))
			.subscribe({
				next: (packet) => {
					console.log('[NWC success]', packet);
					resolve(packet.event);
				},
				complete: () => resolve(null),
				error: reject
			});
		nwcRxReq.emit([{ kinds: [23195], authors: [walletPubkey], '#e': [event.id] }]);
		const sending = nwcRxNostr.send(event);
		submitted = true;
		sending.subscribe({
			next: (packet) => {
				console.log('[NWC send]', packet);
				if (!packet.ok) {
					reject(requestRejected);
				}
			},
			error: reject
		});
		const walletEvent = await promise;
		if (walletEvent === null) {
			console.warn('[NWC no response]');
			return { status: 'unknown' };
		}

		const json = await nip04.decrypt(walletSeckey, walletPubkey, walletEvent.content);

		const response = parsePayInvoiceResponse(json);
		if (response.status === 'success') {
			console.log('[NWC pay invoice]', response);
			return { status: 'success' };
		}
		if (response.status === 'failed') {
			console.error('[NWC payment failed]', response);
			return { status: 'failed', message: response.message };
		}
		return { status: 'unknown' };
	} catch (error) {
		console.error('[NWC failed]', error);
		return { status: !submitted || error === requestRejected ? 'failed' : 'unknown' };
	} finally {
		nwcRxNostr?.dispose();
	}
}
