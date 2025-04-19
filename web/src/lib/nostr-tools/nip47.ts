import { nip04, finalizeEvent, type VerifiedEvent } from 'nostr-tools';
import { kinds } from 'nostr-tools';

interface NWCConnection {
	pubkey: string;
	relay: string;
	secret: string;
}

export function parseConnectionString(connectionString: string): NWCConnection {
	const { hostname, pathname, searchParams } = new URL(connectionString);
	const pubkey = hostname ? hostname : pathname.replaceAll('/', '');
	const relay = searchParams.get('relay');
	const secret = searchParams.get('secret');

	if (!pubkey || !relay || !secret) {
		throw new Error('invalid connection string');
	}

	return { pubkey, relay, secret };
}

export async function makeNwcRequestEvent(
	pubkey: string,
	secretKey: Uint8Array,
	invoice: string
): Promise<VerifiedEvent> {
	const content = {
		method: 'pay_invoice',
		params: {
			invoice
		}
	};
	const encryptedContent = await nip04.encrypt(secretKey, pubkey, JSON.stringify(content));
	const eventTemplate = {
		kind: kinds.NWCWalletRequest,
		created_at: Math.round(Date.now() / 1000),
		content: encryptedContent,
		tags: [['p', pubkey]]
	};

	return finalizeEvent(eventTemplate, secretKey);
}
