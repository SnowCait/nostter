export type NwcPaymentResult =
	| { status: 'success' }
	| { status: 'failed'; message: string }
	| { status: 'unknown'; reason: 'invalid-response' | 'transport' };

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parsePayInvoiceResponse(value: unknown): NwcPaymentResult {
	const invalid = { status: 'unknown', reason: 'invalid-response' } as const;
	if (!isObject(value) || value.result_type !== 'pay_invoice') {
		return invalid;
	}

	if (isObject(value.error)) {
		if (typeof value.error.code !== 'string' || typeof value.error.message !== 'string') {
			return invalid;
		}
		return { status: 'failed', message: value.error.message };
	}

	if (
		value.error === null &&
		isObject(value.result) &&
		typeof value.result.preimage === 'string' &&
		/^[0-9a-f]{64}$/i.test(value.result.preimage)
	) {
		return { status: 'success' };
	}
	return invalid;
}
