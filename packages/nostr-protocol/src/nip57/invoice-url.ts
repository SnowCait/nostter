import type { Event } from 'nostr-tools';

export function buildZapInvoiceUrl(
	callback: string | URL,
	amount: number,
	zapRequestEvent: Event
): URL {
	const requestUrl = new URL(callback);
	requestUrl.searchParams.set('amount', String(amount));
	requestUrl.searchParams.set('nostr', JSON.stringify(zapRequestEvent));
	return requestUrl;
}
