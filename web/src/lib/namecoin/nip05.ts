/**
 * NIP-05 resolution for Namecoin `.bit` identifiers.
 *
 * Accepted shapes:
 *   - `alice@example.bit`
 *   - `example.bit`          (root entry, mapped to `d/example` + `_`)
 *   - `d/example`            (domain namespace)
 *   - `id/alice`             (identity namespace)
 *   - a `nostr:` NIP-21 URI prefix is tolerated
 *
 * Value parsing follows the ifa-0001 Domain Name Object semantics used
 * across the existing Namecoin × Nostr integrations: `nostr.names[<local>]`
 * for `d/` names, `nostr.pubkey` for `id/` names, with optional relays
 * surfaced via `nostr.relays`. A bare `"nostr": "<hex>"` value is the
 * shorthand for the root entry of a single-identity `d/` record.
 */
import { nameShow, type ElectrumXServer, DEFAULT_ELECTRUMX_SERVERS } from './electrumx';
import { getCached, setCached, getInflight, setInflight, deleteInflight } from './cache';

export { DEFAULT_ELECTRUMX_SERVERS, type ElectrumXServer };
export { useWebSocketImplementation } from './electrumx';

const HEX_PUBKEY_RE = /^[0-9a-fA-F]{64}$/;

export type NamecoinResolveResult = {
	pubkey: string;
	relays?: string[];
};

export type ParsedIdentifier = {
	/** The underlying Namecoin name, e.g. `d/example` or `id/alice`. */
	namecoinName: string;
	/** The local-part within the name value, e.g. `alice` or `_`. */
	localPart: string;
	/** True for `d/` names (domain + `names` map), false for `id/`. */
	isDomain: boolean;
};

/** Returns true when `identifier` should be routed to the Namecoin path. */
export function isDotBitIdentifier(identifier?: string | null): boolean {
	if (!identifier) return false;
	let s = identifier.trim().toLowerCase();
	if (s.startsWith('nostr:')) s = s.slice(6);
	if (s.startsWith('d/') || s.startsWith('id/')) return s.length > 2 + 1;
	return s.endsWith('.bit') && s.length > 4;
}

export function parseIdentifier(raw: string): ParsedIdentifier | null {
	let input = raw.trim();
	if (input.length >= 6 && input.slice(0, 6).toLowerCase() === 'nostr:') {
		input = input.slice(6);
	}
	const lower = input.toLowerCase();

	if (lower.startsWith('d/')) {
		const name = lower.slice(2);
		if (!name) return null;
		return { namecoinName: lower, localPart: '_', isDomain: true };
	}
	if (lower.startsWith('id/')) {
		const name = lower.slice(3);
		if (!name) return null;
		return { namecoinName: lower, localPart: '_', isDomain: false };
	}

	if (input.includes('@') && lower.endsWith('.bit')) {
		const atIdx = input.indexOf('@');
		const local = input.slice(0, atIdx).toLowerCase() || '_';
		const domain = input
			.slice(atIdx + 1)
			.toLowerCase()
			.replace(/\.bit$/, '');
		if (!domain) return null;
		return { namecoinName: 'd/' + domain, localPart: local, isDomain: true };
	}

	if (lower.endsWith('.bit')) {
		const domain = lower.replace(/\.bit$/, '');
		if (!domain) return null;
		return { namecoinName: 'd/' + domain, localPart: '_', isDomain: true };
	}

	return null;
}

/**
 * Resolve a `.bit` / `d/` / `id/` identifier to a Nostr profile pointer.
 *
 * Returns `null` on any failure (invalid shape, unregistered name,
 * missing `nostr` field, transport error). Caches positive AND negative
 * results for the lifetime of the runtime; dedupes concurrent lookups.
 */
export async function queryProfile(
	identifier: string,
	servers?: ElectrumXServer[]
): Promise<NamecoinResolveResult | null> {
	const parsed = parseIdentifier(identifier);
	if (!parsed) return null;

	const cached = getCached(identifier);
	if (cached !== undefined) return cached;

	const inflight = getInflight(identifier);
	if (inflight) return inflight;

	const p = (async () => {
		try {
			const valueJSON = await nameShow(parsed.namecoinName, servers);
			if (!valueJSON) {
				setCached(identifier, null);
				return null;
			}
			const result = extractNostrFromValue(valueJSON, parsed);
			setCached(identifier, result);
			return result;
		} catch {
			setCached(identifier, null);
			return null;
		} finally {
			deleteInflight(identifier);
		}
	})();
	setInflight(identifier, p);
	return p;
}

/** Verify that `pubkeyHex` is bound to `identifier` on the Namecoin chain. */
export async function isValid(pubkeyHex: string, identifier: string): Promise<boolean> {
	if (!pubkeyHex || !identifier) return false;
	const res = await queryProfile(identifier);
	return res ? res.pubkey.toLowerCase() === pubkeyHex.toLowerCase() : false;
}

// ---------------------------------------------------------------------------
// JSON value extraction (pure, easy to test)
// ---------------------------------------------------------------------------

export function extractNostrFromValue(
	valueJSON: string,
	parsed: ParsedIdentifier
): NamecoinResolveResult | null {
	let root: Record<string, unknown>;
	try {
		root = JSON.parse(valueJSON) as Record<string, unknown>;
	} catch {
		return null;
	}
	if (typeof root !== 'object' || root === null) return null;

	const nostrField = root['nostr'];
	if (nostrField === undefined || nostrField === null) return null;

	if (typeof nostrField === 'string') {
		if (parsed.isDomain && parsed.localPart !== '_') return null;
		if (!HEX_PUBKEY_RE.test(nostrField)) return null;
		return { pubkey: nostrField.toLowerCase() };
	}

	if (typeof nostrField !== 'object') return null;
	const obj = nostrField as Record<string, unknown>;

	if (parsed.isDomain) return extractFromDomainNamesObject(obj, parsed);
	return extractFromIdentityObject(obj);
}

function extractFromDomainNamesObject(
	obj: Record<string, unknown>,
	parsed: ParsedIdentifier
): NamecoinResolveResult | null {
	const names = obj['names'];
	if (typeof names !== 'object' || names === null) return null;
	const namesMap = names as Record<string, unknown>;

	let pickedPubkey: string | null = null;
	const exact = namesMap[parsed.localPart];
	if (typeof exact === 'string' && HEX_PUBKEY_RE.test(exact)) {
		pickedPubkey = exact;
	} else {
		const underscore = namesMap['_'];
		if (typeof underscore === 'string' && HEX_PUBKEY_RE.test(underscore)) {
			pickedPubkey = underscore;
		} else if (parsed.localPart === '_') {
			for (const v of Object.values(namesMap)) {
				if (typeof v === 'string' && HEX_PUBKEY_RE.test(v)) {
					pickedPubkey = v;
					break;
				}
			}
		}
	}

	if (!pickedPubkey) return null;
	const relays = extractRelays(obj, pickedPubkey);
	return relays
		? { pubkey: pickedPubkey.toLowerCase(), relays }
		: { pubkey: pickedPubkey.toLowerCase() };
}

function extractFromIdentityObject(obj: Record<string, unknown>): NamecoinResolveResult | null {
	const pk = obj['pubkey'];
	if (typeof pk === 'string' && HEX_PUBKEY_RE.test(pk)) {
		const relaysRaw = obj['relays'];
		if (Array.isArray(relaysRaw)) {
			const relays = relaysRaw.filter((r): r is string => typeof r === 'string');
			return relays.length > 0
				? { pubkey: pk.toLowerCase(), relays }
				: { pubkey: pk.toLowerCase() };
		}
		return { pubkey: pk.toLowerCase() };
	}

	const names = obj['names'];
	if (typeof names === 'object' && names !== null) {
		const underscore = (names as Record<string, unknown>)['_'];
		if (typeof underscore === 'string' && HEX_PUBKEY_RE.test(underscore)) {
			const relays = extractRelays(obj, underscore);
			return relays
				? { pubkey: underscore.toLowerCase(), relays }
				: { pubkey: underscore.toLowerCase() };
		}
	}

	return null;
}

function extractRelays(obj: Record<string, unknown>, pubkey: string): string[] | null {
	const raw = obj['relays'];
	if (!raw) return null;
	// Domain shape: keyed by pubkey -> array.
	if (typeof raw === 'object' && !Array.isArray(raw)) {
		const map = raw as Record<string, unknown>;
		const candidate = map[pubkey.toLowerCase()] ?? map[pubkey];
		if (!Array.isArray(candidate)) return null;
		const relays = candidate.filter((r): r is string => typeof r === 'string');
		return relays.length > 0 ? relays : null;
	}
	// Identity shape: flat array.
	if (Array.isArray(raw)) {
		const relays = raw.filter((r): r is string => typeof r === 'string');
		return relays.length > 0 ? relays : null;
	}
	return null;
}
