import type { Event } from 'nostr-tools';
import { describe, expect, it } from 'vitest';
import { shouldReplaceCurrentEvent } from './replaceable-event';

const current: Event = {
	id: 'bb',
	created_at: 1,
	kind: 10000,
	pubkey: 'a'.repeat(64),
	tags: [],
	content: '',
	sig: ''
};

describe('replaceable event replacement', () => {
	it('replaces the current event when the candidate sorts ahead of it', () => {
		expect(shouldReplaceCurrentEvent({ ...current, created_at: 2, id: 'ff' }, current)).toBe(
			true
		);
		expect(shouldReplaceCurrentEvent({ ...current, id: 'aa' }, current)).toBe(true);
		expect(shouldReplaceCurrentEvent({ ...current, id: 'cc' }, current)).toBe(false);
	});

	it('does not replace the current event with itself', () => {
		expect(shouldReplaceCurrentEvent(current, current)).toBe(false);
	});
});
