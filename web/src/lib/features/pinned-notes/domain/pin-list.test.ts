import { describe, expect, it } from 'vitest';
import { applyPinOperations, type PinOperation } from './pin-list';

const author = 'c'.repeat(64);

function pin(eventId: string, relayHint?: string): PinOperation {
	return { type: 'pin', eventId, authorPubkey: author, relayHint };
}

describe('pin list operations', () => {
	it('appends new pins with a known relay hint and the author pubkey', () => {
		const tags = [
			['t', 'topic'],
			['e', 'existing', 'wss://relay'],
			['p', 'author']
		];
		expect(applyPinOperations(tags, [pin('new', 'wss://example.com')])).toEqual([
			...tags,
			['e', 'new', 'wss://example.com', author]
		]);
	});

	it('stores an empty relay hint when none is known', () => {
		expect(applyPinOperations([], [pin('new')])).toEqual([['e', 'new', '', author]]);
	});

	it('does not add a duplicate or rewrite an existing tag with the same event id', () => {
		const tags = [
			['e', 'short'],
			['e', 'hinted', 'wss://relay']
		];
		expect(
			applyPinOperations(tags, [pin('short', 'wss://example.com'), pin('hinted')])
		).toEqual(tags);
	});

	it('removes every matching e tag and reappends a later pin at the end', () => {
		const tags = [
			['e', 'target'],
			['t', 'topic'],
			['e', 'other'],
			['e', 'target', 'wss://relay', author]
		];
		expect(applyPinOperations(tags, [{ type: 'unpin', eventId: 'target' }])).toEqual([
			['t', 'topic'],
			['e', 'other']
		]);
		expect(
			applyPinOperations(tags, [
				{ type: 'unpin', eventId: 'target' },
				pin('target', 'wss://example.com')
			])
		).toEqual([
			['t', 'topic'],
			['e', 'other'],
			['e', 'target', 'wss://example.com', author]
		]);
	});
});
