import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Subject, throwError } from 'rxjs';
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
vi.mock('svelte-i18n', () => ({
	_: {
		subscribe: (run: (value: (key: string) => string) => void) => {
			run((key) => key);
			return () => {};
		}
	}
}));

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
	vi.stubGlobal('alert', vi.fn());
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
	vi.unstubAllGlobals();
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
		await expect(payment).resolves.toBe(true);
		expect(client.dispose).toHaveBeenCalledOnce();
	});

	it('disposes the client and displays the wallet payment error', async () => {
		mocks.decrypt.mockResolvedValue(
			JSON.stringify({
				result_type: 'pay_invoice',
				result: null,
				error: { code: 'PAYMENT_FAILED', message: 'No route' }
			})
		);
		const { payment } = await start();
		respond();
		await expect(payment).resolves.toBe(false);
		expect(alert).toHaveBeenCalledWith('No route');
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
			await expect(payment).resolves.toBe(false);
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
			await expect(zapWithWalletConnect('uri', 'invoice')).resolves.toBe(false);
			expect(client.dispose).toHaveBeenCalledOnce();
		}
	);

	it('handles synchronous subscription rejection followed by a setup exception', async () => {
		client.use.mockReturnValue(throwError(() => new Error('subscription failed')));
		mocks.emit.mockImplementation(() => {
			throw new Error('setup failed');
		});
		await expect(zapWithWalletConnect('uri', 'invoice')).resolves.toBe(false);
		expect(client.dispose).toHaveBeenCalledOnce();
	});

	it('keeps the first response when completion, send failure and timeout follow', async () => {
		const { payment } = await start();
		respond();
		responses.complete();
		sends.next({ ok: false });
		vi.advanceTimersByTime(10000);
		await expect(payment).resolves.toBe(true);
		expect(mocks.decrypt).toHaveBeenCalledOnce();
		expect(client.dispose).toHaveBeenCalledOnce();
	});

	it('reports no response after ten seconds and ignores a late response', async () => {
		const { payment } = await start();
		vi.advanceTimersByTime(9999);
		expect(client.dispose).not.toHaveBeenCalled();
		expect(alert).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		respond();
		await expect(payment).resolves.toBe(false);
		expect(mocks.decrypt).not.toHaveBeenCalled();
		expect(alert).toHaveBeenCalledExactlyOnceWith('wallet.unknown');
		expect(vi.getTimerCount()).toBe(0);
		expect(client.dispose).toHaveBeenCalledOnce();
	});

	it('disposes the client when decrypting the response fails', async () => {
		mocks.decrypt.mockRejectedValue(new Error('decrypt failed'));
		const { payment } = await start();
		respond();
		await expect(payment).resolves.toBe(false);
		expect(client.dispose).toHaveBeenCalledOnce();
	});
});
