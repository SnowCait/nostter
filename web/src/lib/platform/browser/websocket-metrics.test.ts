import { createRxForwardReq } from 'rx-nostr';
import { BunkerSigner } from 'nostr-tools/nip46';
import { SimplePool } from 'nostr-tools/pool';
import { afterEach, describe, expect, it, vi } from 'vitest';

const environment = vi.hoisted(() => ({ browser: false }));
vi.mock('$app/environment', () => environment);
vi.mock('$lib/nostr/verification/client', () => ({
	verificationClient: { verifier: () => true }
}));
vi.mock('nostr-tools/nip46', () => ({ BunkerSigner: { fromBunker: vi.fn() } }));

class NativeWebSocket extends EventTarget {
	static OPEN = 1;
	static instances: NativeWebSocket[] = [];
	readonly url: string;
	readyState = 0;
	onopen?: () => void;

	constructor(url: string | URL) {
		super();
		this.url = new URL(url).href;
		NativeWebSocket.instances.push(this);
	}

	open() {
		this.readyState = NativeWebSocket.OPEN;
		this.dispatchEvent(new Event('open'));
		this.onopen?.();
	}

	send(data: Parameters<WebSocket['send']>[0]) {
		void data;
		if (this.readyState !== NativeWebSocket.OPEN) {
			throw new Error('Socket is not open');
		}
	}

	close() {
		this.readyState = 3;
	}
}

afterEach(() => {
	vi.unstubAllGlobals();
	vi.resetModules();
	vi.clearAllMocks();
	environment.browser = false;
	NativeWebSocket.instances = [];
});

describe('shared WebSocket metrics', () => {
	it('can be evaluated on the server without browser APIs', async () => {
		for (const api of ['WebSocket', 'requestAnimationFrame', 'TextEncoder', 'Blob']) {
			vi.stubGlobal(api, undefined);
		}
		const { MetricsWebSocket, metrics } = await import('./websocket-metrics');
		expect(MetricsWebSocket).toBeUndefined();
		expect(metrics).toBeUndefined();
	});

	it('combines rx-nostr and bunker pool traffic without changing SimplePool defaults', async () => {
		environment.browser = true;
		vi.stubGlobal('WebSocket', NativeWebSocket);
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}')));
		const { MetricsWebSocket, metrics } = await import('./websocket-metrics');
		const { createRelayClient } = await import('$lib/nostr/relay/client');
		const { RemoteSignerClient } = await import('$lib/nostr/signing/remote-signer-client');
		const url = 'wss://relay.example.com/path?key=value';
		const client = createRelayClient(() => undefined);
		const request = createRxForwardReq();
		const subscription = client.use(request).subscribe();
		const connection = {
			connect: vi.fn().mockResolvedValue(undefined),
			getPublicKey: vi.fn().mockResolvedValue('user'),
			close: vi.fn().mockResolvedValue(undefined)
		};
		vi.mocked(BunkerSigner.fromBunker).mockReturnValue(connection as unknown as BunkerSigner);
		let pool: SimplePool | undefined;
		try {
			client.setDefaultRelays([url]);
			request.emit({ kinds: [1] });
			await vi.waitFor(() => expect(NativeWebSocket.instances).toHaveLength(1));
			const rxSocket = NativeWebSocket.instances[0];
			expect(rxSocket).toBeInstanceOf(MetricsWebSocket!);
			rxSocket.open();
			await vi.waitFor(() => expect(metrics?.getSnapshot().total.sent.messages).toBe(1));
			await RemoteSignerClient.connect(
				{ pubkey: 'remote', relays: [url], secret: null },
				new Uint8Array(32),
				{ onAuth: vi.fn(), timeoutMs: 1000 }
			);
			pool = vi.mocked(BunkerSigner.fromBunker).mock.lastCall?.[2]?.pool;
			expect(pool).toBeInstanceOf(SimplePool);
			const defaults = new SimplePool();
			for (const setting of [
				'verifyEvent',
				'maxWaitForConnection',
				'enablePing',
				'enableReconnect',
				'idleTimeout'
			] as const) {
				expect(pool?.[setting]).toBe(defaults[setting]);
			}
			const connecting = pool!.ensureRelay(url);
			const bunkerSocket = NativeWebSocket.instances[1];
			expect(bunkerSocket).toBeInstanceOf(MetricsWebSocket!);
			bunkerSocket.open();
			const relay = await connecting;
			const before = metrics!.getSnapshot().total.sent;
			await relay.send('日本語');
			rxSocket.dispatchEvent(new MessageEvent('message', { data: '["NOTICE","hello"]' }));
			const snapshot = metrics!.getSnapshot();
			expect(Object.keys(snapshot.byKey)).toEqual([url]);
			expect(snapshot.byKey[url]).toEqual(snapshot.total);
			expect(snapshot.total.sent).toEqual({ bytes: before.bytes + 9, messages: 2 });
			expect(snapshot.total.received).toEqual({ bytes: 18, messages: 1 });
			expect(globalThis.WebSocket).toBe(NativeWebSocket);
		} finally {
			pool?.destroy();
			subscription.unsubscribe();
			client.dispose();
		}
	});
});
