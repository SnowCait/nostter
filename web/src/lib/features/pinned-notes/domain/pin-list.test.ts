import { describe, expect, it } from 'vitest';
import { applyPinOperations } from './pin-list';

describe('pin list operations', () => {
	it('appends public pins while preserving other tags, hints, and order', () => {
		const tags = [
			['t', 'topic'],
			['e', 'existing', 'wss://relay'],
			['p', 'author']
		];
		expect(applyPinOperations(tags, [{ type: 'pin', eventId: 'new' }])).toEqual([
			...tags,
			['e', 'new']
		]);
		expect(applyPinOperations(tags, [{ type: 'pin', eventId: 'existing' }])).toEqual(tags);
	});

	it('removes every matching e tag and reappends a later pin at the end', () => {
		const tags = [
			['e', 'target'],
			['t', 'topic'],
			['e', 'other'],
			['e', 'target', 'hint']
		];
		expect(applyPinOperations(tags, [{ type: 'unpin', eventId: 'target' }])).toEqual([
			['t', 'topic'],
			['e', 'other']
		]);
		expect(
			applyPinOperations(tags, [
				{ type: 'unpin', eventId: 'target' },
				{ type: 'pin', eventId: 'target' }
			])
		).toEqual([
			['t', 'topic'],
			['e', 'other'],
			['e', 'target']
		]);
	});
});
