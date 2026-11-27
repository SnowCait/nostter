/**
 * Thin wrapper around `nostr-tools` NIP-05 lookups that routes
 * Namecoin `.bit` identifiers to the chain resolver instead of HTTPS.
 *
 * All existing call sites use the same `{ pubkey, relays? }` shape, so
 * the wrapper returns the same `ProfilePointer | null` contract. When
 * the identifier is not a `.bit`-style name, the call falls through
 * to `nip05.queryProfile` from `nostr-tools` unchanged.
 */
import { nip05 } from 'nostr-tools';
import type { ProfilePointer } from 'nostr-tools/nip19';
import { isDotBitIdentifier, queryProfile as queryNamecoin } from './namecoin';

/**
 * Resolve a NIP-05 identifier. `.bit` (Namecoin) identifiers are
 * resolved over the Namecoin chain; everything else falls through to
 * nostr-tools.
 */
export async function queryProfile(identifier: string): Promise<ProfilePointer | null> {
	if (isDotBitIdentifier(identifier)) {
		const result = await queryNamecoin(identifier);
		if (!result) return null;
		return { pubkey: result.pubkey, relays: result.relays ?? [] };
	}
	return nip05.queryProfile(identifier);
}
