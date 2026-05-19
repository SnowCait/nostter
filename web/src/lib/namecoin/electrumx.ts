/**
 * Browser-native ElectrumX client for Namecoin `name_show` lookups.
 *
 * Queries a small pool of public Namecoin ElectrumX servers over WSS,
 * locates the most recent `NAME_UPDATE` transaction for `d/<domain>` or
 * `id/<name>` via the scripthash history, and returns the raw value
 * string for the caller to parse.
 *
 * Wire format mirrors the parallel ports in:
 *   - Amethyst    (Kotlin, vitorpamplona/amethyst, several merged PRs)
 *   - Nostur      (Swift, nostur-com/Nostur PR #60)
 *   - nostr-tools (JS,    nbd-wtf/nostr-tools PR #533, in review)
 *   - Jumble      (JS,    CodyTseng/jumble PR #774, in review)
 *   - nostrudel   (JS,    hzrd149/nostrudel PR #352, in review)
 *   - dart-nostr  (Dart,  ethicnology/dart-nostr PR #44, merged)
 */
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

/** A single Namecoin ElectrumX endpoint. */
export type ElectrumXServer = {
	/** Hostname, e.g. `electrum.nmc.ethicnology.com`. */
	host: string;
	/** Port, e.g. `50004` for the WSS endpoint. */
	port: number;
	/** WSS path. Defaults to `/`. */
	path?: string;
};

/**
 * Default Namecoin ElectrumX WSS pool, tried in order.
 *
 * This is the browser-WSS subset of amethyst's
 * `quartz/.../namecoin/ElectrumXServer.kt` `DEFAULT_ELECTRUMX_SERVERS`.
 * Amethyst additionally carries two bare-IP entries (`23.158.233.10`,
 * `46.229.238.187`) over its JVM TLS path, but browsers refuse WSS to
 * bare IPs without an IP-SAN certificate so we intentionally omit them
 * here. The Let's Encrypt-fronted `electrum.nmc.ethicnology.com` host
 * is the most browser-friendly; the other three currently serve
 * self-signed certs and will only succeed if the user has explicitly
 * trusted them in their browser (TOFU). This matches the calm-failure
 * UX: `.bit` verification is optional and falls back silently.
 */
export const DEFAULT_ELECTRUMX_SERVERS: ElectrumXServer[] = [
	{ host: 'electrumx.testls.space', port: 50004 },
	{ host: 'nmc2.bitcoins.sk', port: 57004 },
	{ host: 'relay.testls.bit', port: 50004 },
	{ host: 'electrum.nmc.ethicnology.com', port: 50004 }
];

/** ~250 days, the Namecoin name expiry depth. */
const NAME_EXPIRE_DEPTH = 36000;

const OP_NAME_UPDATE = 0x53;
const OP_2DROP = 0x6d;
const OP_DROP = 0x75;
const OP_RETURN = 0x6a;
const OP_PUSHDATA1 = 0x4c;
const OP_PUSHDATA2 = 0x4d;
const OP_PUSHDATA4 = 0x4e;

const textEncoder = new TextEncoder();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WebSocketCtor = any;
let _WebSocket: WebSocketCtor = (globalThis as { WebSocket?: WebSocketCtor }).WebSocket;

/** Inject a WebSocket implementation (useful in Node tests). */
export function useWebSocketImplementation(impl: WebSocketCtor): void {
	_WebSocket = impl;
}

class NameMissError extends Error {}

/** Look up `name` across the configured servers; returns the value string or `null`. */
export async function nameShow(
	name: string,
	servers: ElectrumXServer[] = DEFAULT_ELECTRUMX_SERVERS
): Promise<string | null> {
	let definitiveMiss = false;
	for (const srv of servers) {
		try {
			return await nameShowOne(name, srv);
		} catch (err) {
			if (err instanceof NameMissError) {
				definitiveMiss = true;
				continue;
			}
			// Transport error — try next.
		}
	}
	if (definitiveMiss) return null;
	return null;
}

async function nameShowOne(name: string, srv: ElectrumXServer): Promise<string | null> {
	if (!_WebSocket) {
		throw new Error('namecoin: no WebSocket implementation available');
	}

	const url = buildWSSUrl(srv);
	const rpc = new RPC(new _WebSocket(url));
	try {
		await rpc.opened;
		await rpc.call('server.version', ['nostter/namecoin-nip05', '1.4']);

		const script = buildNameIndexScript(textEncoder.encode(name));
		const scriptHash = electrumScriptHash(script);
		const history = await rpc.call<Array<{ tx_hash: string; height: number }>>(
			'blockchain.scripthash.get_history',
			[scriptHash]
		);
		if (!history || history.length === 0) throw new NameMissError();
		const latest = history[history.length - 1];

		const tx = await rpc.call<{ vout: Array<{ scriptPubKey?: { hex?: string } }> }>(
			'blockchain.transaction.get',
			[latest.tx_hash, true]
		);

		let currentHeight = 0;
		try {
			const header = await rpc.call<{ height?: number }>('blockchain.headers.subscribe', []);
			if (header && typeof header.height === 'number') currentHeight = header.height;
		} catch {
			// Non-fatal: skip the expiry guard.
		}
		if (
			currentHeight > 0 &&
			latest.height > 0 &&
			currentHeight - latest.height >= NAME_EXPIRE_DEPTH
		) {
			return null;
		}

		return extractNameValue(tx.vout, name);
	} finally {
		rpc.close();
	}
}

function buildWSSUrl(srv: ElectrumXServer): string {
	const path = srv.path ?? '/';
	return `wss://${srv.host}:${srv.port}${path.startsWith('/') ? path : '/' + path}`;
}

/** Minimal JSON-RPC-2.0 over WebSocket. */
class RPC {
	opened: Promise<void>;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private ws: any;
	private id = 0;
	private pending = new Map<
		number,
		{ resolve: (v: unknown) => void; reject: (e: Error) => void }
	>();

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	constructor(ws: any) {
		this.ws = ws;
		this.opened = new Promise((resolve, reject) => {
			ws.addEventListener('open', () => resolve());
			ws.addEventListener('error', () => reject(new Error('websocket error')));
			ws.addEventListener('close', () => {
				for (const p of this.pending.values()) p.reject(new Error('websocket closed'));
				this.pending.clear();
			});
		});
		ws.addEventListener('message', (ev: { data: unknown }) => this.onMessage(ev));
	}

	async call<T = unknown>(method: string, params: unknown[]): Promise<T> {
		const id = ++this.id;
		const msg = JSON.stringify({ jsonrpc: '2.0', id, method, params });
		return new Promise<T>((resolve, reject) => {
			this.pending.set(id, { resolve: (v) => resolve(v as T), reject });
			try {
				this.ws.send(msg);
			} catch (e) {
				this.pending.delete(id);
				reject(e instanceof Error ? e : new Error(String(e)));
			}
		});
	}

	private onMessage(ev: { data: unknown }): void {
		let parsed: { id?: number; result?: unknown; error?: unknown };
		try {
			const data =
				typeof ev.data === 'string'
					? ev.data
					: new TextDecoder().decode(ev.data as ArrayBuffer);
			parsed = JSON.parse(data);
		} catch {
			return;
		}
		if (typeof parsed.id !== 'number') return;
		const p = this.pending.get(parsed.id);
		if (!p) return;
		this.pending.delete(parsed.id);
		if (parsed.error) {
			p.reject(
				new Error(
					typeof parsed.error === 'string' ? parsed.error : JSON.stringify(parsed.error)
				)
			);
		} else {
			p.resolve(parsed.result);
		}
	}

	close(): void {
		try {
			this.ws.close();
		} catch {
			// ignore
		}
	}
}

function buildNameIndexScript(nameBytes: Uint8Array): Uint8Array {
	const parts: number[] = [];
	parts.push(OP_NAME_UPDATE);
	pushData(parts, nameBytes);
	pushData(parts, new Uint8Array(0));
	parts.push(OP_2DROP, OP_DROP, OP_RETURN);
	return new Uint8Array(parts);
}

function pushData(out: number[], data: Uint8Array): void {
	const n = data.length;
	if (n < OP_PUSHDATA1) {
		out.push(n);
	} else if (n <= 0xff) {
		out.push(OP_PUSHDATA1, n);
	} else {
		out.push(OP_PUSHDATA2, n & 0xff, (n >> 8) & 0xff);
	}
	for (let i = 0; i < n; i++) out.push(data[i]);
}

/** SHA-256 of `script`, byte-reversed, hex-encoded. */
function electrumScriptHash(script: Uint8Array): string {
	const digest = sha256(script);
	const reversed = new Uint8Array(digest.length);
	for (let i = 0; i < digest.length; i++) reversed[i] = digest[digest.length - 1 - i];
	return bytesToHex(reversed);
}

export function extractNameValue(
	vouts: Array<{ scriptPubKey?: { hex?: string } }>,
	name: string
): string | null {
	for (const vout of vouts || []) {
		const hex = vout?.scriptPubKey?.hex;
		if (!hex || !hex.startsWith('53')) continue;
		let bytes: Uint8Array;
		try {
			bytes = hexToBytes(hex);
		} catch {
			continue;
		}
		const parsed = parseNameScript(bytes);
		if (!parsed) continue;
		if (parsed.name === name) return parsed.value;
	}
	return null;
}

function parseNameScript(script: Uint8Array): { name: string; value: string } | null {
	if (script.length === 0 || script[0] !== OP_NAME_UPDATE) return null;
	let pos = 1;
	const nameRead = readPushData(script, pos);
	if (!nameRead) return null;
	pos = nameRead.next;
	const valueRead = readPushData(script, pos);
	if (!valueRead) return null;
	const decoder = new TextDecoder('utf-8', { fatal: false });
	return { name: decoder.decode(nameRead.data), value: decoder.decode(valueRead.data) };
}

function readPushData(script: Uint8Array, pos: number): { data: Uint8Array; next: number } | null {
	if (pos >= script.length) return null;
	const op = script[pos];
	if (op === 0x00) return { data: new Uint8Array(0), next: pos + 1 };
	if (op < OP_PUSHDATA1) {
		const length = op;
		const end = pos + 1 + length;
		if (end > script.length) return null;
		return { data: script.slice(pos + 1, end), next: end };
	}
	if (op === OP_PUSHDATA1) {
		if (pos + 2 > script.length) return null;
		const length = script[pos + 1];
		const end = pos + 2 + length;
		if (end > script.length) return null;
		return { data: script.slice(pos + 2, end), next: end };
	}
	if (op === OP_PUSHDATA2) {
		if (pos + 3 > script.length) return null;
		const length = script[pos + 1] | (script[pos + 2] << 8);
		const end = pos + 3 + length;
		if (end > script.length) return null;
		return { data: script.slice(pos + 3, end), next: end };
	}
	if (op === OP_PUSHDATA4) {
		if (pos + 5 > script.length) return null;
		const length =
			script[pos + 1] |
			(script[pos + 2] << 8) |
			(script[pos + 3] << 16) |
			(script[pos + 4] << 24);
		const end = pos + 5 + length;
		if (end < 0 || end > script.length) return null;
		return { data: script.slice(pos + 5, end), next: end };
	}
	return null;
}

function hexToBytes(hex: string): Uint8Array {
	if (hex.length % 2 !== 0) throw new Error('hex: odd length');
	const out = new Uint8Array(hex.length / 2);
	for (let i = 0; i < out.length; i++) {
		const b = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
		if (Number.isNaN(b)) throw new Error('hex: invalid byte');
		out[i] = b;
	}
	return out;
}

/** Suppress the unused-variable warning for opcodes kept for readability. */
void OP_DROP;
void OP_RETURN;
