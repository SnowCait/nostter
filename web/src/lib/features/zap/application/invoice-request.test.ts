import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Signer } from '$lib/nostr/signing/signer';
import { InvoiceRequest } from './invoice-request.svelte';

let request: InvoiceRequest;
const createRequest = vi.fn<() => ReturnType<Signer['signEvent']>>();
const getZapUrl = vi.fn<() => Promise<URL | null>>();
const onInvoice = vi.fn<(invoice: string) => Promise<void>>();
const fetchInvoice = vi.fn<typeof fetch>();
const options = { amount: 1000, createRequest, getZapUrl, onInvoice };

beforeEach(() => {
	vi.resetAllMocks();
	request = new InvoiceRequest();
	createRequest.mockResolvedValue({ content: 'signed' } as Awaited<
		ReturnType<Signer['signEvent']>
	>);
	getZapUrl.mockResolvedValue(new URL('https://example.com/invoice'));
	onInvoice.mockResolvedValue(undefined);
	fetchInvoice.mockResolvedValue(new Response(JSON.stringify({ pr: 'lnbc-invoice' })));
	vi.stubGlobal('fetch', fetchInvoice);
	vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('Zap invoice acquisition', () => {
	it.each(['signing', 'url', 'network', 'http', 'json', 'invalid'] as const)(
		'exposes a safe %s error and releases sending so the same form can retry',
		async (stage) => {
			switch (stage) {
				case 'signing':
					createRequest.mockRejectedValueOnce(new Error('private signing detail'));
					break;
				case 'url':
					getZapUrl.mockResolvedValueOnce(null);
					break;
				case 'network':
					fetchInvoice.mockRejectedValueOnce(new Error('private network detail'));
					break;
				case 'http':
					fetchInvoice.mockResolvedValueOnce(
						new Response('private server body', { status: 500 })
					);
					break;
				case 'json':
					fetchInvoice.mockResolvedValueOnce(new Response('not JSON'));
					break;
				case 'invalid':
					fetchInvoice.mockResolvedValueOnce(new Response('{"pr":" "}'));
					break;
			}
			await request.send(options);
			expect(request.error).toBe(stage);
			expect(request.sending).toBe(false);
			expect(onInvoice).not.toHaveBeenCalled();
			expect(console.error).toHaveBeenCalled();
			await request.send(options);
			expect(request.error).toBeUndefined();
			expect(request.sending).toBe(false);
			expect(onInvoice).toHaveBeenCalledExactlyOnceWith('lnbc-invoice');
		}
	);

	it.each([null, {}, { pr: null }, { pr: 123 }, { pr: '' }])(
		'rejects invalid invoice payload %j',
		async (payment) => {
			fetchInvoice.mockResolvedValueOnce(new Response(JSON.stringify(payment)));
			await request.send(options);
			expect(request.error).toBe('invalid');
			expect(onInvoice).not.toHaveBeenCalled();
		}
	);

	it('clears the previous error and blocks duplicates through acquisition and NWC processing', async () => {
		getZapUrl.mockResolvedValueOnce(null);
		await request.send(options);
		const signing = Promise.withResolvers<Awaited<ReturnType<Signer['signEvent']>>>();
		createRequest.mockReturnValueOnce(signing.promise);
		const payment = Promise.withResolvers<void>();
		onInvoice.mockReturnValueOnce(payment.promise);
		const retry = request.send(options);
		expect(request.error).toBeUndefined();
		expect(request.sending).toBe(true);
		await request.send(options);
		expect(createRequest).toHaveBeenCalledTimes(2);
		signing.resolve({ content: 'signed' } as Awaited<ReturnType<Signer['signEvent']>>);
		await vi.waitFor(() => expect(onInvoice).toHaveBeenCalledOnce());
		expect(request.sending).toBe(true);
		await request.send(options);
		expect(onInvoice).toHaveBeenCalledOnce();
		payment.resolve();
		await retry;
		expect(request.sending).toBe(false);
	});

	it('does not label a downstream payment exception as an invoice failure', async () => {
		onInvoice.mockRejectedValueOnce(new Error('NWC failed'));
		await expect(request.send(options)).rejects.toThrow('NWC failed');
		expect(request.error).toBeUndefined();
		expect(request.sending).toBe(false);
	});
});
