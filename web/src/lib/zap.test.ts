import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Subject } from 'rxjs';
import { zapWithWalletConnect } from './Zap';

const mocks = vi.hoisted(() => ({
	create: vi.fn(),
	request: vi.fn(),
	emit: vi.fn(),
	decrypt: vi.fn()
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
let client: {
	setDefaultRelays: ReturnType<typeof vi.fn>;
	use: ReturnType<typeof vi.fn>;
	send: ReturnType<typeof vi.fn>;
	dispose: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
	vi.useFakeTimers();
	vi.resetAllMocks();
	responses = new Subject();
	sends = new Subject();
	client = {
		setDefaultRelays: vi.fn(),
		use: vi.fn(() => responses),
		send: vi.fn(() => {
			expect(responses.observed).toBe(true);
			expect(mocks.emit).toHaveBeenCalledOnce();
			return sends;
		}),
		dispose: vi.fn()
	};
	mocks.create.mockReturnValue(client);
	mocks.request.mockResolvedValue({ id: 'request-id' });
	mocks.decrypt.mockResolvedValue(
		JSON.stringify({
			result_type: 'pay_invoice',
			error: null,
			result: { preimage: 'a'.repeat(64) }
		})
	);
});
afterEach(() => {
	vi.useRealTimers();
});

async function start() {
	const payment = zapWithWalletConnect('uri', 'invoice');
	await vi.advanceTimersByTimeAsync(0);
	return { payment };
}
function respond() {
	responses.next({ event: { content: 'encrypted' } });
}

describe('NWC communication lifecycle', () => {
	it('listens before sending and disposes the client on a successful payment', async () => {
		const { payment } = await start();
		expect(client.send).toHaveBeenCalledOnce();
		respond();
		await expect(payment).resolves.toEqual({ status: 'success' });
		expect(client.dispose).toHaveBeenCalledOnce();
	});

	it('disposes the client and returns the wallet payment error', async () => {
		mocks.decrypt.mockResolvedValue(
			JSON.stringify({
				result_type: 'pay_invoice',
				result: null,
				error: { code: 'PAYMENT_FAILED', message: 'No route' }
			})
		);
		const { payment } = await start();
		respond();
		await expect(payment).resolves.toEqual({ status: 'failed', message: 'No route' });
		expect(client.dispose).toHaveBeenCalledOnce();
	});

	it.each(['response error', 'response complete', 'send error', 'send rejected'])(
		'disposes the client on %s',
		async (failure) => {
			const { payment } = await start();
			switch (failure) {
				case 'response error':
					responses.error(new Error('disconnected'));
					break;
				case 'response complete':
					responses.complete();
					break;
				case 'send error':
					sends.error(new Error('disconnected'));
					break;
				case 'send rejected':
					sends.next({ ok: false });
					break;
			}
			await expect(payment).resolves.toEqual({
				status: failure === 'send rejected' ? 'failed' : 'unknown'
			});
			expect(client.dispose).toHaveBeenCalledOnce();
		}
	);

	it.each(['setDefaultRelays', 'use', 'emit', 'send'])(
		'disposes the client when %s throws during setup',
		async (stage) => {
			const fail = () => {
				throw new Error('setup failed');
			};
			if (stage === 'emit') {
				mocks.emit.mockImplementation(fail);
			} else {
				client[stage as 'setDefaultRelays' | 'use' | 'send'].mockImplementation(fail);
			}
			await expect(zapWithWalletConnect('uri', 'invoice')).resolves.toEqual({
				status: 'failed'
			});
			expect(client.dispose).toHaveBeenCalledOnce();
		}
	);

	it('keeps the first response when completion, send failure and timeout follow', async () => {
		const { payment } = await start();
		respond();
		responses.complete();
		sends.next({ ok: false });
		vi.advanceTimersByTime(10000);
		await expect(payment).resolves.toEqual({ status: 'success' });
		expect(mocks.decrypt).toHaveBeenCalledOnce();
		expect(client.dispose).toHaveBeenCalledOnce();
	});

	it('reports no response after ten seconds and ignores a late response', async () => {
		const { payment } = await start();
		vi.advanceTimersByTime(9999);
		expect(client.dispose).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		respond();
		await expect(payment).resolves.toEqual({ status: 'unknown' });
		expect(mocks.decrypt).not.toHaveBeenCalled();
		expect(vi.getTimerCount()).toBe(0);
		expect(client.dispose).toHaveBeenCalledOnce();
	});

	it('disposes the client when decrypting the response fails', async () => {
		mocks.decrypt.mockRejectedValue(new Error('decrypt failed'));
		const { payment } = await start();
		respond();
		await expect(payment).resolves.toEqual({ status: 'unknown' });
		expect(client.dispose).toHaveBeenCalledOnce();
	});
});

it('classifies request creation failure before sending as failed', async () => {
	mocks.request.mockRejectedValue(new Error('cannot encrypt'));
	await expect(zapWithWalletConnect('uri', 'invoice')).resolves.toEqual({ status: 'failed' });
	expect(client.send).not.toHaveBeenCalled();
});
it.each(['not JSON', JSON.stringify({ result_type: 'pay_invoice', error: null, result: {} })])(
	'treats an invalid wallet response as unknown: %s',
	async (json) => {
		mocks.decrypt.mockResolvedValue(json);
		const { payment } = await start();
		respond();
		await expect(payment).resolves.toEqual({ status: 'unknown' });
		expect(client.dispose).toHaveBeenCalledOnce();
	}
);
