import { MetricsWebSocket } from '$lib/platform/browser/websocket-metrics';
import { get } from 'svelte/store';
import { _ } from 'svelte-i18n';
import { nip04 } from 'nostr-tools';
import { createRxForwardReq, createRxNostr, noopSigner } from 'rx-nostr';
import { EMPTY, take, timeout } from 'rxjs';
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

	try {
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
				error: (error) => {
					console.error('[NWC error]', error);
					reject(error);
				}
			});
		nwcRxReq.emit([{ kinds: [23195], authors: [walletPubkey], '#e': [event.id] }]);
		nwcRxNostr.send(event).subscribe({
			next: (packet) => {
				console.log('[NWC send]', packet);
				if (!packet.ok) {
					reject(new Error('NWC request rejected'));
				}
			},
			error: (error) => reject(error)
		});
		const walletEvent = await promise;
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
		nwcRxNostr.dispose();
	}
}
