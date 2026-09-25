import { describe, expect, it } from 'vitest';
import { isPreferredReplaceableEvent } from './replaceable-event';

describe('NIP-01 replaceable event preference', () => {
	it('prefers the newer timestamp regardless of event id', () => {
		expect(
			isPreferredReplaceableEvent({ created_at: 2, id: 'ff' }, { created_at: 1, id: '00' })
		).toBe(true);
		expect(
			isPreferredReplaceableEvent({ created_at: 1, id: '00' }, { created_at: 2, id: 'ff' })
		).toBe(false);
	});

	it('prefers the lexicographically smaller id at the same timestamp', () => {
		expect(
			isPreferredReplaceableEvent({ created_at: 1, id: '00' }, { created_at: 1, id: 'ff' })
		).toBe(true);
		expect(
			isPreferredReplaceableEvent({ created_at: 1, id: 'ff' }, { created_at: 1, id: '00' })
		).toBe(false);
	});

	it('does not treat an identical event as preferred', () => {
		const event = { created_at: 1, id: '00' };
		expect(isPreferredReplaceableEvent(event, event)).toBe(false);
	});
});
