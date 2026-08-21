import { describe, expect, it, vi } from 'vitest';
import { canCloseNoteDraft, hasNoteDraft } from './NoteDraft';

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

describe('canCloseNoteDraft', () => {
	it('does not close or confirm while the editor is busy', () => {
		const confirmClose = vi.fn(() => true);
		expect(canCloseNoteDraft('posting', true, true, confirmClose)).toBe(false);
		expect(confirmClose).not.toHaveBeenCalled();
	});

	it('allows closing again after processing finishes and confirmation succeeds', () => {
		expect(canCloseNoteDraft('draft', false, false, () => true)).toBe(true);
	});

	it('closes an empty editor without confirmation', () => {
		const confirmClose = vi.fn(() => false);
		expect(canCloseNoteDraft('', false, false, confirmClose)).toBe(true);
		expect(confirmClose).not.toHaveBeenCalled();
	});
});
