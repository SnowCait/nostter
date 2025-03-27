import { get } from 'svelte/store';
import { _ } from 'svelte-i18n';
import { nip04 } from 'nostr-tools';
import { createRxForwardReq, createRxNostr, noopSigner } from 'rx-nostr';
import { seckeySigner } from 'rx-nostr-crypto';
import type { Event } from 'nostr-typedef';
import { makeNwcRequestEvent, parseConnectionString } from '$lib/nostr-tools/nip47';
import { verificationClient } from './timelines/MainTimeline';

export async function zapWithWalletConnect(uri: string, invoice: string): Promise<boolean> {
	const {
		pubkey: walletPubkey,
		relay: walletRelay,
		secret: walletSeckey
	} = parseConnectionString(uri);
	console.debug('[NWC info]', walletRelay, walletPubkey);
	const event = await makeNwcRequestEvent(walletPubkey, walletSeckey, invoice);
	console.debug('[NWC event]', event);

	const nwcRxNostr = createRxNostr({
		verifier: verificationClient.verifier,
		signer: noopSigner(),
		authenticator: {
			signer: seckeySigner(walletSeckey)
		}
	});
	nwcRxNostr.setDefaultRelays([walletRelay]);

	const { promise, resolve, reject } = Promise.withResolvers<Event | null>();

	const timeout = setTimeout(() => {
		console.debug('[NWC timeout]');
		reject();
	}, 10000);

	try {
		const nwcRxReq = createRxForwardReq();
		nwcRxNostr.use(nwcRxReq).subscribe({
			next: (packet) => {
				console.log('[NWC success]', packet);
				resolve(packet.event);
			},
			complete: () => {
				resolve(null);
			},
			error: (error) => {
				console.error('[NWC error]', error);
				reject();
			}
		});

		nwcRxReq.emit([{ kinds: [23195], authors: [walletPubkey], '#e': [event.id] }]);

		nwcRxNostr.send(event).subscribe({
			next: (packet) => {
				console.log('[NWC send]', packet);
				if (!packet.ok) {
					reject();
				}
			},
			error: () => {
				reject();
			}
		});

		const walletEvent = await promise;
		clearTimeout(timeout);

		if (walletEvent === null) {
			console.warn('[NWC no response]');
			alert(get(_)('wallet.unknown'));
			return false;
		}

		const json = await nip04.decrypt(walletSeckey, walletPubkey, walletEvent.content);

		// Error example: {"error":{"code":"EXPIRED","message":"This app has expired"},"result_type":"pay_invoice"}
		const payInvoice = JSON.parse(json);
		if (payInvoice.error === undefined) {
			console.log('[NWC pay invoice]', payInvoice);
			return true;
		} else {
			console.error('[NWC error]', payInvoice);
			alert(payInvoice.error.message);
			return false;
		}
	} catch (error) {
		console.error('[NWC failed]', error);
		return false;
	} finally {
		nwcRxNostr.dispose();
	}
}
