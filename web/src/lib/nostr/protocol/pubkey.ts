import { isHex32 } from 'nostr-tools/utils';

export function isValidPubkey(value: unknown): value is string {
	return typeof value === 'string' && isHex32(value);
}
