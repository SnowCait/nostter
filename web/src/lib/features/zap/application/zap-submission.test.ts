import { describe, expect, it, vi } from 'vitest';
import type { NwcPaymentResult } from '$lib/nostr/protocol/nip47';
import { ZapSubmission } from './zap-submission.svelte';

function setup() {
	const state = new ZapSubmission();
	const options = {
		prepareInvoice: vi.fn(async () => 'lnbc-invoice'),
		pay: vi.fn<() => Promise<NwcPaymentResult>>(async () => ({ status: 'success' })),
		onPaid: vi.fn(),
		isOpen: () => true,
		failureMessage: 'Please try again'
	};
	return { state, options };
}

describe('Zap submission', () => {
	it('completes only after confirmed NWC payment and releases the sending state', async () => {
		const { state, options } = setup();
		const payment = Promise.withResolvers<NwcPaymentResult>();
		options.pay.mockReturnValue(payment.promise);
		const task = state.submit(options);
		await vi.waitFor(() => expect(options.pay).toHaveBeenCalledOnce());
		expect(state.sending).toBe(true);
		expect(options.onPaid).not.toHaveBeenCalled();
		payment.resolve({ status: 'success' });
		await task;
		expect(options.onPaid).toHaveBeenCalledOnce();
		expect(state.sending).toBe(false);
	});

	it('shows an external invoice without completing the Zap', async () => {
		const { state, options } = setup();
		await state.submit({ ...options, pay: undefined });
		expect(state.invoice).toBe('lnbc-invoice');
		expect(state.sending).toBe(false);
		expect(options.onPaid).not.toHaveBeenCalled();
		state.reset();
		expect(state.invoice).toBe('');
	});

	it('blocks duplicate submissions throughout invoice preparation and payment', async () => {
		const { state, options } = setup();
		const invoice = Promise.withResolvers<string>();
		options.prepareInvoice.mockReturnValue(invoice.promise);
		const task = state.submit(options);
		await state.submit(options);
		expect(options.prepareInvoice).toHaveBeenCalledOnce();
		invoice.resolve('invoice');
		await task;
		expect(options.pay).toHaveBeenCalledOnce();
	});

	it('releases the sending state and allows retry after invoice preparation fails', async () => {
		const { state, options } = setup();
		options.prepareInvoice.mockRejectedValueOnce(new Error('Signing rejected'));
		await state.submit(options);
		expect(state.error).toBe('Signing rejected');
		expect(state.sending).toBe(false);
		expect(options.pay).not.toHaveBeenCalled();
		await state.submit(options);
		expect(state.error).toBe('');
		expect(options.onPaid).toHaveBeenCalledOnce();
	});

	it('shows an explicit wallet failure and allows retry', async () => {
		const { state, options } = setup();
		options.pay.mockResolvedValueOnce({ status: 'failed', message: 'Insufficient balance' });
		await state.submit(options);
		expect(state.error).toBe('Insufficient balance');
		expect(state.invoice).toBe('');
		expect(state.sending).toBe(false);
		expect(options.onPaid).not.toHaveBeenCalled();
		await state.submit(options);
		expect(options.onPaid).toHaveBeenCalledOnce();
	});

	it.each(['transport', 'invalid-response'] as const)(
		'blocks retry and external fallback after an unknown %s outcome, including reopening',
		async (reason) => {
			const { state, options } = setup();
			options.pay.mockResolvedValue({ status: 'unknown', reason });
			await state.submit(options);
			expect(state.unknown?.reason).toBe(reason);
			expect(state.sending).toBe(false);
			expect(state.invoice).toBe('');
			expect(options.onPaid).not.toHaveBeenCalled();
			state.reset();
			await state.submit(options);
			expect(options.pay).toHaveBeenCalledOnce();
		}
	);

	it('allows a deliberate retry only after the user confirms nonpayment', async () => {
		const { state, options } = setup();
		options.pay.mockResolvedValueOnce({ status: 'unknown', reason: 'transport' });
		await state.submit(options);
		state.confirmUnpaid();
		expect(state.unknown).toBeUndefined();
		await state.submit(options);
		expect(options.pay).toHaveBeenCalledTimes(2);
		expect(options.onPaid).toHaveBeenCalledOnce();
	});

	it('does not unlock a payment that is still in progress', async () => {
		const { state, options } = setup();
		const payment = Promise.withResolvers<NwcPaymentResult>();
		options.pay.mockReturnValue(payment.promise);
		const task = state.submit(options);
		await vi.waitFor(() => expect(options.pay).toHaveBeenCalledOnce());
		state.confirmUnpaid();
		expect(state.unknown).toBeDefined();
		payment.resolve({ status: 'unknown', reason: 'transport' });
		await task;
	});

	it('treats an unexpected payment exception as uncertain', async () => {
		const { state, options } = setup();
		options.pay.mockRejectedValue(new Error('Disconnected'));
		await state.submit(options);
		expect(state.unknown?.reason).toBe('transport');
		expect(state.sending).toBe(false);
		expect(state.invoice).toBe('');
		expect(options.onPaid).not.toHaveBeenCalled();
	});

	it('discards a previous dialog invoice without dispatching payment', async () => {
		const { state, options } = setup();
		const invoice = Promise.withResolvers<string>();
		options.prepareInvoice.mockReturnValue(invoice.promise);
		const task = state.submit(options);
		state.reset();
		invoice.resolve('old invoice');
		await task;
		expect(state.invoice).toBe('');
		expect(options.pay).not.toHaveBeenCalled();
		expect(state.sending).toBe(false);
	});

	it.each<NwcPaymentResult>([{ status: 'success' }, { status: 'failed', message: 'Old error' }])(
		'does not apply a previous dialog payment result %j',
		async (result) => {
			const { state, options } = setup();
			const payment = Promise.withResolvers<NwcPaymentResult>();
			options.pay.mockReturnValue(payment.promise);
			const task = state.submit(options);
			await vi.waitFor(() => expect(options.pay).toHaveBeenCalledOnce());
			state.reset();
			await state.submit(options);
			expect(options.pay).toHaveBeenCalledOnce();
			payment.resolve(result);
			await task;
			expect(options.onPaid).not.toHaveBeenCalled();
			expect(state.error).toBe('');
			expect(state.sending).toBe(false);
		}
	);

	it('discards errors after the dialog closes and clears errors on reopening', async () => {
		const { state, options } = setup();
		options.prepareInvoice.mockRejectedValueOnce(new Error('Current error'));
		await state.submit(options);
		expect(state.error).toBe('Current error');
		state.reset();
		expect(state.error).toBe('');
		const invoice = Promise.withResolvers<string>();
		options.prepareInvoice.mockReturnValue(invoice.promise);
		const task = state.submit(options);
		state.reset();
		invoice.reject(new Error('Old error'));
		await task;
		expect(state.error).toBe('');
	});
});
