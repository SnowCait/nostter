import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Subject } from 'rxjs';
import { zapWithWalletConnect } from './Zap';

const mocks = vi.hoisted(() => ({
	create: vi.fn(),
	decrypt: vi.fn(),
	request: vi.fn(),
	emit: vi.fn()
}));
vi.mock('rx-nostr', () => ({
	createRxNostr: mocks.create,
	createRxForwardReq: () => ({ emit: mocks.emit }),
	noopSigner: vi.fn()
}));
vi.mock('@rx-nostr/crypto', () => ({ seckeySigner: vi.fn() }));
vi.mock('nostr-tools', () => ({ nip04: { decrypt: mocks.decrypt } }));
vi.mock('$lib/nostr-tools/nip47', () => ({
	parseConnectionString: () => ({
		pubkey: 'wallet',
		relay: 'wss://relay',
		secret: 'ab'.repeat(32)
	}),
	makeNwcRequestEvent: mocks.request
}));
vi.mock('./timelines/MainTimeline', () => ({ verificationClient: { verifier: vi.fn() } }));
vi.mock('$lib/platform/browser/websocket-metrics', () => ({ MetricsWebSocket: vi.fn() }));

let responses: Subject<{ event: { content: string } }>;
let sends: Subject<{ ok: boolean }>;
let dispose: ReturnType<typeof vi.fn>;

beforeEach(() => {
	vi.useFakeTimers();
	vi.resetAllMocks();
	responses = new Subject();
	sends = new Subject();
	dispose = vi.fn();
	mocks.request.mockResolvedValue({ id: 'request-id' });
	mocks.create.mockReturnValue({
		setDefaultRelays: vi.fn(),
		use: () => responses,
		send: () => sends,
		dispose
	});
	mocks.decrypt.mockResolvedValue(
		JSON.stringify({
			result_type: 'pay_invoice',
			error: null,
			result: { preimage: 'a'.repeat(64) }
		})
	);
});

afterEach(() => vi.useRealTimers());

async function startPayment() {
	const payment = zapWithWalletConnect('uri', 'invoice');
	await vi.advanceTimersByTimeAsync(0);
	return { payment };
}

function expectCleanedUp() {
	expect(dispose).toHaveBeenCalledOnce();
	expect(responses.observed).toBe(false);
	expect(sends.observed).toBe(false);
	expect(vi.getTimerCount()).toBe(0);
}

describe('NWC payment lifecycle', () => {
	it('subscribes to the request response and accepts error: null', async () => {
		const { payment } = await startPayment();
		expect(mocks.emit).toHaveBeenCalledWith([
			{ kinds: [23195], authors: ['wallet'], '#e': ['request-id'] }
		]);
		responses.next({ event: { content: 'encrypted' } });
		await expect(payment).resolves.toEqual({ status: 'success' });
		expectCleanedUp();
	});

	it('returns an explicit payment failure message', async () => {
		mocks.decrypt.mockResolvedValue(
			JSON.stringify({
				result_type: 'pay_invoice',
				error: { code: 'EXPIRED', message: 'This app has expired' }
			})
		);
		const { payment } = await startPayment();
		responses.next({ event: { content: 'encrypted' } });
		await expect(payment).resolves.toEqual({
			status: 'failed',
			message: 'This app has expired'
		});
		expectCleanedUp();
	});

	it.each(['not JSON', '{"result_type":"pay_invoice","result":{}}'])(
		'returns unknown for malformed response %s',
		async (content) => {
			mocks.decrypt.mockResolvedValue(content);
			const { payment } = await startPayment();
			responses.next({ event: { content: 'encrypted' } });
			await expect(payment).resolves.toEqual({
				status: 'unknown',
				reason: 'invalid-response'
			});
			expectCleanedUp();
		}
	);

	it('returns unknown after timeout and releases all resources', async () => {
		const { payment } = await startPayment();
		sends.next({ ok: true });
		await vi.advanceTimersByTimeAsync(10000);
		await expect(payment).resolves.toEqual({ status: 'unknown', reason: 'transport' });
		expectCleanedUp();
	});

	it.each(['subscription error', 'send error', 'rejected publish', 'completed subscription'])(
		'returns unknown after %s and releases all resources',
		async (failure) => {
			const { payment } = await startPayment();
			if (failure === 'subscription error') {
				responses.error(new Error('disconnected'));
			}
			if (failure === 'send error') {
				sends.error(new Error('disconnected'));
			}
			if (failure === 'rejected publish') {
				sends.next({ ok: false });
			}
			if (failure === 'completed subscription') {
				responses.complete();
			}
			await expect(payment).resolves.toEqual({ status: 'unknown', reason: 'transport' });
			expectCleanedUp();
		}
	);

	it('does not claim nonpayment when decryption fails', async () => {
		mocks.decrypt.mockRejectedValue(new Error('Cannot decrypt'));
		const { payment } = await startPayment();
		responses.next({ event: { content: 'encrypted' } });
		await expect(payment).resolves.toEqual({ status: 'unknown', reason: 'invalid-response' });
		expectCleanedUp();
	});

	it('allows retry for setup failure before dispatch', async () => {
		mocks.request.mockRejectedValueOnce(new Error('Invalid connection'));
		await expect(zapWithWalletConnect('uri', 'invoice')).resolves.toEqual({
			status: 'failed',
			message: 'Invalid connection'
		});
		expect(mocks.create).not.toHaveBeenCalled();
		const { payment } = await startPayment();
		responses.next({ event: { content: 'encrypted' } });
		await expect(payment).resolves.toEqual({ status: 'success' });
		expectCleanedUp();
	});
});
