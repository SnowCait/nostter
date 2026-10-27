import type { NwcPaymentResult } from '$lib/nostr/protocol/nip47';

export class ZapSubmission {
	invoice = $state('');
	error = $state('');
	sending = $state(false);
	unknown = $state<NwcPaymentResult & { status: 'unknown' }>();
	#session = 0;

	reset() {
		this.#session++;
		this.invoice = '';
		this.error = '';
		// An outstanding or uncertain payment must keep blocking payment after reopening.
	}

	confirmUnpaid() {
		if (!this.sending) {
			this.unknown = undefined;
		}
	}

	async submit({
		prepareInvoice,
		pay,
		onPaid,
		isOpen,
		failureMessage
	}: {
		prepareInvoice: () => Promise<string>;
		pay?: (invoice: string) => Promise<NwcPaymentResult>;
		onPaid: () => void;
		isOpen: () => boolean;
		failureMessage: string;
	}) {
		if (this.sending || this.unknown) {
			return;
		}
		const session = this.#session;
		const current = () => session === this.#session && isOpen();
		this.sending = true;
		this.error = '';
		this.invoice = '';
		try {
			const invoice = await prepareInvoice();
			if (!current()) {
				return;
			}
			if (!pay) {
				this.invoice = invoice;
				return;
			}

			// Once dispatched, exceptions cannot prove that the invoice is unpaid.
			this.unknown = { status: 'unknown', reason: 'transport' };
			const result = await pay(invoice);
			this.unknown = result.status === 'unknown' ? result : undefined;
			if (!current()) {
				return;
			}
			if (result.status === 'success') {
				onPaid();
			} else if (result.status === 'failed') {
				this.error = result.message || failureMessage;
			}
		} catch (error) {
			if (current() && !this.unknown) {
				this.error =
					error instanceof Error && error.message ? error.message : failureMessage;
			}
		} finally {
			this.sending = false;
		}
	}
}
