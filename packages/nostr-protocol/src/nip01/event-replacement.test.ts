import type { Event } from 'nostr-tools';
import { describe, expect, it } from 'vitest';
import { shouldReplaceCurrentEvent } from './event-replacement.js';

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
	it('adopts the candidate when there is no current event', () => {
		expect(shouldReplaceCurrentEvent(current, undefined)).toBe(true);
	});

	it('replaces the current event with a newer candidate', () => {
		expect(shouldReplaceCurrentEvent({ ...current, created_at: 2, id: 'ff' }, current)).toBe(
			true
		);
	});

	it('does not replace the current event with an older candidate', () => {
		expect(shouldReplaceCurrentEvent({ ...current, created_at: 0, id: 'aa' }, current)).toBe(
			false
		);
	});

	it('prefers the smaller ID when timestamps match', () => {
		expect(shouldReplaceCurrentEvent({ ...current, id: 'aa' }, current)).toBe(true);
	});

	it('does not prefer the larger ID when timestamps match', () => {
		expect(shouldReplaceCurrentEvent({ ...current, id: 'cc' }, current)).toBe(false);
	});

	it('does not replace the current event with itself', () => {
		expect(shouldReplaceCurrentEvent(current, current)).toBe(false);
	});
});

describe('addressable event replacement', () => {
	it('replaces an event with a newer candidate sharing its pubkey, kind, and d tag', () => {
		const article: Event = { ...current, kind: 30023, tags: [['d', 'article']] };
		const candidate: Event = { ...article, created_at: 2, id: 'ff' };
		expect(shouldReplaceCurrentEvent(candidate, article)).toBe(true);
	});
});
