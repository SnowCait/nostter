import { describe, it, expect, beforeEach } from 'vitest';
import {
	isDotBitIdentifier,
	parseIdentifier,
	extractNostrFromValue,
	queryProfile,
	isValid,
	useWebSocketImplementation
} from './nip05';
import { _resetCache } from './cache';

describe('namecoin/nip05 — identifier detection', () => {
	it('accepts .bit shapes', () => {
		expect(isDotBitIdentifier('alice.bit')).toBe(true);
		expect(isDotBitIdentifier('ALICE.BIT')).toBe(true);
		expect(isDotBitIdentifier('alice@example.bit')).toBe(true);
		expect(isDotBitIdentifier('d/example')).toBe(true);
		expect(isDotBitIdentifier('id/alice')).toBe(true);
		expect(isDotBitIdentifier('nostr:d/example')).toBe(true);
		expect(isDotBitIdentifier('  alice@example.bit  ')).toBe(true);
	});

	it('rejects DNS NIP-05 and empty input', () => {
		expect(isDotBitIdentifier('')).toBe(false);
		expect(isDotBitIdentifier(null)).toBe(false);
		expect(isDotBitIdentifier(undefined)).toBe(false);
		expect(isDotBitIdentifier('alice@example.com')).toBe(false);
		expect(isDotBitIdentifier('example.com')).toBe(false);
		expect(isDotBitIdentifier('d')).toBe(false);
		expect(isDotBitIdentifier('d/')).toBe(false);
		expect(isDotBitIdentifier('.bit')).toBe(false);
	});
});

describe('namecoin/nip05 — parseIdentifier', () => {
	it('parses bare .bit names', () => {
		expect(parseIdentifier('example.bit')).toEqual({
			namecoinName: 'd/example',
			localPart: '_',
			isDomain: true
		});
	});

	it('parses user@example.bit', () => {
		expect(parseIdentifier('alice@example.bit')).toEqual({
			namecoinName: 'd/example',
			localPart: 'alice',
			isDomain: true
		});
	});

	it('parses d/<name> and id/<name>', () => {
		expect(parseIdentifier('d/testls')).toEqual({
			namecoinName: 'd/testls',
			localPart: '_',
			isDomain: true
		});
		expect(parseIdentifier('id/alice')).toEqual({
			namecoinName: 'id/alice',
			localPart: '_',
			isDomain: false
		});
	});

	it('tolerates a nostr: NIP-21 prefix', () => {
		expect(parseIdentifier('nostr:alice@example.bit')).toEqual({
			namecoinName: 'd/example',
			localPart: 'alice',
			isDomain: true
		});
	});

	it('lowercases on parse', () => {
		const p = parseIdentifier('Alice@EXAMPLE.bit');
		expect(p?.localPart).toBe('alice');
		expect(p?.namecoinName).toBe('d/example');
	});

	it('returns null for malformed input', () => {
		expect(parseIdentifier('')).toBeNull();
		expect(parseIdentifier('alice@.bit')).toBeNull();
	});
});

describe('namecoin/nip05 — extractNostrFromValue', () => {
	const pk = 'a'.repeat(64);
	const pkB = 'b'.repeat(64);

	it('handles the simple "nostr": "<hex>" form on the root entry', () => {
		const v = JSON.stringify({ nostr: pk });
		const got = extractNostrFromValue(v, {
			namecoinName: 'd/example',
			localPart: '_',
			isDomain: true
		});
		expect(got).toEqual({ pubkey: pk });
	});

	it('rejects the simple form on a non-root local-part', () => {
		const v = JSON.stringify({ nostr: pk });
		expect(
			extractNostrFromValue(v, {
				namecoinName: 'd/example',
				localPart: 'alice',
				isDomain: true
			})
		).toBeNull();
	});

	it('picks the exact local-part from a domain names object', () => {
		const v = JSON.stringify({ nostr: { names: { alice: pk, bob: pkB } } });
		const got = extractNostrFromValue(v, {
			namecoinName: 'd/example',
			localPart: 'alice',
			isDomain: true
		});
		expect(got).toEqual({ pubkey: pk });
	});

	it('falls back to the _ root entry', () => {
		const v = JSON.stringify({ nostr: { names: { _: pk } } });
		const got = extractNostrFromValue(v, {
			namecoinName: 'd/example',
			localPart: '_',
			isDomain: true
		});
		expect(got).toEqual({ pubkey: pk });
	});

	it('surfaces relays for a domain names object', () => {
		const v = JSON.stringify({
			nostr: { names: { alice: pk }, relays: { [pk]: ['wss://r1', 'wss://r2'] } }
		});
		const got = extractNostrFromValue(v, {
			namecoinName: 'd/example',
			localPart: 'alice',
			isDomain: true
		});
		expect(got).toEqual({ pubkey: pk, relays: ['wss://r1', 'wss://r2'] });
	});

	it('handles the id/ identity object shape', () => {
		const v = JSON.stringify({ nostr: { pubkey: pk, relays: ['wss://r1'] } });
		const got = extractNostrFromValue(v, {
			namecoinName: 'id/alice',
			localPart: '_',
			isDomain: false
		});
		expect(got).toEqual({ pubkey: pk, relays: ['wss://r1'] });
	});

	it('returns null when the value has no nostr field', () => {
		expect(
			extractNostrFromValue('{}', {
				namecoinName: 'd/example',
				localPart: '_',
				isDomain: true
			})
		).toBeNull();
	});

	it('returns null when the pubkey is not 64-char hex', () => {
		const v = JSON.stringify({ nostr: 'not-a-pubkey' });
		expect(
			extractNostrFromValue(v, {
				namecoinName: 'd/example',
				localPart: '_',
				isDomain: true
			})
		).toBeNull();
	});

	it('returns null on invalid JSON', () => {
		expect(
			extractNostrFromValue('not-json', {
				namecoinName: 'd/example',
				localPart: '_',
				isDomain: true
			})
		).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// Resolver integration — uses a mock WebSocket implementation, so no
// network calls leak out of the test runner.
// ---------------------------------------------------------------------------

type Listener = (ev: { data: unknown }) => void;

class MockSocket {
	url: string;
	private listeners = new Map<string, Set<Listener>>();
	private responder: (msg: { id: number; method: string; params: unknown[] }) => unknown;

	constructor(url: string, responder: typeof MockSocket.prototype.responder) {
		this.url = url;
		this.responder = responder;
		setTimeout(() => this.emit('open', {}), 0);
	}

	addEventListener(type: string, fn: Listener): void {
		if (!this.listeners.has(type)) this.listeners.set(type, new Set());
		this.listeners.get(type)!.add(fn);
	}

	send(raw: string): void {
		const msg = JSON.parse(raw);
		const result = this.responder(msg);
		setTimeout(() => {
			this.emit('message', { data: JSON.stringify({ jsonrpc: '2.0', id: msg.id, result }) });
		}, 0);
	}

	close(): void {
		this.emit('close', {});
	}

	private emit(type: string, ev: unknown): void {
		const set = this.listeners.get(type);
		if (!set) return;
		for (const fn of set) fn(ev as { data: unknown });
	}
}

function installMock(
	responder: (msg: { id: number; method: string; params: unknown[] }) => unknown
): void {
	useWebSocketImplementation(function (this: unknown, url: string) {
		return new MockSocket(url, responder);
	} as unknown);
}

describe('namecoin/nip05 — queryProfile with mock ElectrumX', () => {
	const pk = 'c'.repeat(64);

	beforeEach(() => {
		_resetCache();
	});

	it('resolves a .bit address end-to-end through the mock socket', async () => {
		// scriptPubKey hex for: OP_NAME_UPDATE PUSH("d/example") PUSH(<value>) OP_2DROP OP_DROP OP_RETURN <pad>
		// (only the first three pushes are inspected by the parser.)
		const nameAscii = 'd/example';
		const value = JSON.stringify({ nostr: pk });
		const valueBytes = new TextEncoder().encode(value);
		const nameBytes = new TextEncoder().encode(nameAscii);

		const hex: string[] = [];
		hex.push('53'); // OP_NAME_UPDATE
		// PUSH name
		hex.push(nameBytes.length.toString(16).padStart(2, '0'));
		for (const b of nameBytes) hex.push(b.toString(16).padStart(2, '0'));
		// PUSH value (use OP_PUSHDATA1 since value > 0x4b bytes)
		hex.push('4c');
		hex.push(valueBytes.length.toString(16).padStart(2, '0'));
		for (const b of valueBytes) hex.push(b.toString(16).padStart(2, '0'));
		// Trailing 2drop drop return
		hex.push('6d', '75', '6a');
		const scriptHex = hex.join('');

		installMock((msg) => {
			switch (msg.method) {
				case 'server.version':
					return ['ElectrumX 1.4', '1.4'];
				case 'blockchain.scripthash.get_history':
					return [{ tx_hash: 'aa'.repeat(32), height: 1000 }];
				case 'blockchain.transaction.get':
					return { vout: [{ scriptPubKey: { hex: scriptHex } }] };
				case 'blockchain.headers.subscribe':
					return { height: 1001 }; // not expired
				default:
					return null;
			}
		});

		const got = await queryProfile('example.bit');
		expect(got).toEqual({ pubkey: pk });

		// Second call hits the positive cache; the responder is not
		// invoked again. We confirm by clearing the mock first.
		installMock(() => {
			throw new Error('should not be called — cache hit expected');
		});
		const got2 = await queryProfile('example.bit');
		expect(got2).toEqual({ pubkey: pk });
	});

	it('caches negative lookups and short-circuits subsequent calls', async () => {
		installMock((msg) => {
			if (msg.method === 'server.version') return ['ElectrumX 1.4', '1.4'];
			if (msg.method === 'blockchain.scripthash.get_history') return [];
			return null;
		});
		const got = await queryProfile('doesnotexist.bit');
		expect(got).toBeNull();

		installMock(() => {
			throw new Error('should not be called — negative cache expected');
		});
		const again = await queryProfile('doesnotexist.bit');
		expect(again).toBeNull();
	});

	it('isValid returns false for an invalid identifier shape', async () => {
		expect(await isValid(pk, 'alice@example.com')).toBe(false);
	});

	it('isValid returns false when required args are missing', async () => {
		expect(await isValid('', 'example.bit')).toBe(false);
		expect(await isValid(pk, '')).toBe(false);
	});
});
