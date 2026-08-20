import { describe, expect, it } from 'vitest';
import { hasNoteDraft } from './NoteDraft';

describe('hasNoteDraft', () => {
	it('includes attachment-only drafts', () => {
		expect(hasNoteDraft('', true)).toBe(true);
	});

	it('is false when both content and attachments are empty', () => {
		expect(hasNoteDraft('', false)).toBe(false);
	});

	it('includes text drafts without attachments', () => {
		expect(hasNoteDraft('draft', false)).toBe(true);
	});
});
