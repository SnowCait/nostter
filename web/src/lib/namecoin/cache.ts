/**
 * Session-level in-memory cache for Namecoin `.bit` NIP-05 resolutions.
 * Survives across components within a single browser session and dedupes
 * concurrent lookups. No TTL — entries live for the lifetime of the
 * runtime; on a hard navigation the cache is rebuilt.
 */
import type { NamecoinResolveResult } from './nip05';

const POS_CACHE = new Map<string, NamecoinResolveResult>();
const NEG_CACHE = new Set<string>();
const INFLIGHT = new Map<string, Promise<NamecoinResolveResult | null>>();

function normalizeKey(identifier: string): string {
	return identifier.trim().toLowerCase();
}

export function getCached(identifier: string): NamecoinResolveResult | null | undefined {
	const key = normalizeKey(identifier);
	if (POS_CACHE.has(key)) return POS_CACHE.get(key)!;
	if (NEG_CACHE.has(key)) return null;
	return undefined;
}

export function setCached(identifier: string, result: NamecoinResolveResult | null): void {
	const key = normalizeKey(identifier);
	if (result) {
		POS_CACHE.set(key, result);
		NEG_CACHE.delete(key);
	} else {
		NEG_CACHE.add(key);
		POS_CACHE.delete(key);
	}
}

export function getInflight(identifier: string): Promise<NamecoinResolveResult | null> | undefined {
	return INFLIGHT.get(normalizeKey(identifier));
}

export function setInflight(identifier: string, p: Promise<NamecoinResolveResult | null>): void {
	INFLIGHT.set(normalizeKey(identifier), p);
}

export function deleteInflight(identifier: string): void {
	INFLIGHT.delete(normalizeKey(identifier));
}

/** Test-only helper. Resets cache state. */
export function _resetCache(): void {
	POS_CACHE.clear();
	NEG_CACHE.clear();
	INFLIGHT.clear();
}
