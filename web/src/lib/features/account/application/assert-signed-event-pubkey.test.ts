import { describe, expect, it } from 'vitest';
import { assertSignedEventPubkey } from './assert-signed-event-pubkey';

const accountA = 'a'.repeat(64);
const accountB = 'b'.repeat(64);

describe('assertSignedEventPubkey', () => {
	it('accepts the captured publication account and rejects another signer account', () => {
		expect(() => assertSignedEventPubkey({ pubkey: accountA }, accountA)).not.toThrow();
		expect(() => assertSignedEventPubkey({ pubkey: accountB }, accountA)).toThrow(
			'Signed event pubkey does not match the publication account'
		);
	});
});
