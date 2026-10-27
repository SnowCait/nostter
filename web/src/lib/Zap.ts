import { MetricsWebSocket } from '$lib/platform/browser/websocket-metrics';
import { get } from 'svelte/store';
import { _ } from 'svelte-i18n';
import { nip04 } from 'nostr-tools';
import { createRxForwardReq, createRxNostr, noopSigner } from 'rx-nostr';
import { Subscription } from 'rxjs';
import { seckeySigner } from '@rx-nostr/crypto';
import type * as Nostr from 'nostr-typedef';
import { makeNwcRequestEvent, parseConnectionString } from '$lib/nostr-tools/nip47';
import { verificationClient } from './timelines/MainTimeline';
import { hexToBytes } from 'nostr-tools/utils';
import { parsePayInvoiceResponse } from '@nostter/nostr-protocol';

export async function zapWithWalletConnect(uri: string, invoice: string): Promise<boolean> {
	const {
		pubkey: walletPubkey,
		relay: walletRelay,
		secret: walletSeckey
	} = parseConnectionString(uri);
	console.debug('[NWC info]', walletRelay, walletPubkey);
	const event = await makeNwcRequestEvent(walletPubkey, hexToBytes(walletSeckey), invoice);
	console.debug('[NWC event]', event);

	const nwcRxNostr = createRxNostr({
		websocketCtor: MetricsWebSocket,
		verifier: verificationClient.verifier,
		signer: noopSigner(),
		authenticator: {
			signer: seckeySigner(walletSeckey)
		}
	});
	const subscriptions = new Subscription();
	let timeout: ReturnType<typeof setTimeout> | undefined;

	try {
		nwcRxNostr.setDefaultRelays([walletRelay]);
		type Outcome = { event: Nostr.Event | null } | { error: unknown };
		const { promise, resolve } = Promise.withResolvers<Outcome>();
		let settled = false;
		const finish = (outcome: Outcome) => {
			if (settled) {
				return;
			}
			settled = true;
			resolve(outcome);
		};
		timeout = setTimeout(() => {
			console.debug('[NWC timeout]');
			finish({ error: new Error('NWC response timed out') });
		}, 10000);

		const nwcRxReq = createRxForwardReq();
		subscriptions.add(
			nwcRxNostr.use(nwcRxReq).subscribe({
				next: (packet) => {
					console.log('[NWC success]', packet);
					finish({ event: packet.event });
				},
				complete: () => finish({ event: null }),
				error: (error) => {
					console.error('[NWC error]', error);
					finish({ error });
				}
			})
		);

		if (!settled) {
			nwcRxReq.emit([{ kinds: [23195], authors: [walletPubkey], '#e': [event.id] }]);
		}
		if (!settled) {
			subscriptions.add(
				nwcRxNostr.send(event).subscribe({
					next: (packet) => {
						console.log('[NWC send]', packet);
						if (!packet.ok) {
							finish({ error: new Error('NWC request rejected') });
						}
					},
					error: (error) => finish({ error })
				})
			);
		}

		const outcome = await promise;
		if ('error' in outcome) {
			throw outcome.error;
		}
		const walletEvent = outcome.event;
		if (walletEvent === null) {
			console.warn('[NWC no response]');
			alert(get(_)('wallet.unknown'));
			return false;
		}

		const json = await nip04.decrypt(walletSeckey, walletPubkey, walletEvent.content);

		const response = parsePayInvoiceResponse(json);
		if (response.status === 'success') {
			console.log('[NWC pay invoice]', response);
			return true;
		}
		if (response.status === 'failed') {
			console.error('[NWC payment failed]', response);
			alert(response.message);
		}
		return false;
	} catch (error) {
		console.error('[NWC failed]', error);
		return false;
	} finally {
		clearTimeout(timeout);
		try {
			subscriptions.unsubscribe();
		} finally {
			nwcRxNostr.dispose();
		}
	}
}
