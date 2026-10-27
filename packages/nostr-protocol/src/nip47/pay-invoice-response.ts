export type PayInvoiceResponse =
	{ status: 'success' } | { status: 'failed'; message: string } | { status: 'invalid' };

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parsePayInvoiceResponse(json: string): PayInvoiceResponse {
	let value: unknown;
	try {
		value = JSON.parse(json);
	} catch {
		return { status: 'invalid' };
	}

	if (!isObject(value) || value.result_type !== 'pay_invoice') {
		return { status: 'invalid' };
	}

	if (isObject(value.error)) {
		const { code, message } = value.error;
		if (
			typeof code !== 'string' ||
			code.trim() === '' ||
			typeof message !== 'string' ||
			message.trim() === ''
		) {
			return { status: 'invalid' };
		}
		return { status: 'failed', message };
	}

	if (
		(value.error === null || value.error === undefined) &&
		isObject(value.result) &&
		typeof value.result.preimage === 'string' &&
		/^[0-9a-f]{64}$/i.test(value.result.preimage)
	) {
		return { status: 'success' };
	}

	return { status: 'invalid' };
}
