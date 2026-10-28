import type { Signer } from '$lib/nostr/signing/signer';

type InvoiceError = 'signing' | 'url' | 'network' | 'http' | 'json' | 'invalid';

export class InvoiceRequest {
	sending = $state(false);
	error = $state<InvoiceError>();

	async send({
		amount,
		createRequest,
		getZapUrl,
		onInvoice
	}: {
		amount: number;
		createRequest: () => ReturnType<Signer['signEvent']>;
		getZapUrl: () => Promise<URL | null | undefined>;
		onInvoice: (invoice: string) => Promise<void>;
	}) {
		if (this.sending) {
			return;
		}
		this.sending = true;
		this.error = undefined;
		try {
			let invoice: string;
			let stage: InvoiceError = 'signing';
			let detail: unknown;
			try {
				const event = await createRequest();
				const encoded = encodeURI(JSON.stringify(event));
				stage = 'url';
				const zapUrl = await getZapUrl();
				if (!zapUrl) {
					throw new Error('Zap URL not found');
				}
				stage = 'network';
				const response = await fetch(`${zapUrl.href}?amount=${amount}&nostr=${encoded}`);
				stage = 'http';
				if (!response.ok) {
					detail = { status: response.status, body: await response.text() };
					throw new Error('Invoice endpoint returned an HTTP error');
				}
				stage = 'json';
				const payment = await response.json();
				stage = 'invalid';
				detail = payment;
				if (typeof payment?.pr !== 'string' || payment.pr.trim() === '') {
					throw new Error('Invoice response has no non-empty pr');
				}
				invoice = payment.pr;
			} catch (error) {
				console.error('[zap invoice failed]', stage, error, detail);
				this.error = stage;
				return;
			}
			await onInvoice(invoice);
		} finally {
			this.sending = false;
		}
	}
}
