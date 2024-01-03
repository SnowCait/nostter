import { nip04, type Event, getEventHash, signEvent, getPublicKey } from 'nostr-tools';

export function parseConnectionString(connectionString: string): {
	pubkey: string;
	relay: string;
	secret: string;
} {
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
	secretKey: string,
	invoice: string
): Promise<Event> {
	const content = {
		method: 'pay_invoice',
		params: {
			invoice
		}
	};
	const encryptedContent = await nip04.encrypt(secretKey, pubkey, JSON.stringify(content));
	const eventTemplate = {
		kind: 23194,
		created_at: Math.round(Date.now() / 1000),
		content: encryptedContent,
		tags: [['p', pubkey]]
	};
	const event = eventTemplate as Event;
	event.pubkey = getPublicKey(secretKey);
	event.id = getEventHash(event);
	event.sig = signEvent(event, secretKey);
	return event;
}
