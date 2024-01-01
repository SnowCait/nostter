import { nip04 } from 'nostr-tools';
import { createRxForwardReq, createRxNostr } from 'rx-nostr';
import type { Event } from 'nostr-typedef';
import { makeNwcRequestEvent, parseConnectionString } from '$lib/nostr-tools/nip47';

export async function zapWithWalletConnect(uri: string, invoice: string): Promise<boolean> {
	const {
		pubkey: walletPubkey,
		relay: walletRelay,
		secret: walletSeckey
	} = parseConnectionString(uri);
	const event = await makeNwcRequestEvent(walletPubkey, walletSeckey, invoice);

	const nwcRxNostr = createRxNostr();
	nwcRxNostr.setDefaultRelays([walletRelay]);

	try {
		const walletEvent = await new Promise<Event>((resolve, reject) => {
			const nwcRxReq = createRxForwardReq();
			nwcRxNostr.use(nwcRxReq).subscribe((packet) => {
				console.log('[NWC]', packet);
				resolve(packet.event);
			});

			nwcRxReq.emit([{ kinds: [23195], authors: [walletPubkey], '#e': [event.id] }]);

			nwcRxNostr.send(event).subscribe({
				next: (packet) => {
					console.log('[NWC send]', packet);
				},
				error: () => {
					reject();
				}
			});
		});

		const json = await nip04.decrypt(walletSeckey, walletPubkey, walletEvent.content);

		// Error example: {"error":{"code":"EXPIRED","message":"This app has expired"},"result_type":"pay_invoice"}
		const payInvoice = JSON.parse(json);
		if (payInvoice.error === undefined) {
			console.log('[NWC pay invoice]', payInvoice);
			return true;
		} else {
			console.error('[NWC error]', payInvoice);
			return false;
		}
	} catch (error) {
		console.log('[NWC failed]');
		return false;
	} finally {
		nwcRxNostr.dispose();
	}
}
