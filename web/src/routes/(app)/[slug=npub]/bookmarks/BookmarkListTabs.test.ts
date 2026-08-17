import { describe, expect, it } from 'vitest';
import {
	getAdjacentBookmarkListTab,
	getBookmarkListTabs,
	legacyBookmarkListId,
	resolveSelectedBookmarkList,
	standardBookmarkListId
} from './BookmarkListTabs';

describe('Bookmark list tabs', () => {
	it.each([
		[true, false, standardBookmarkListId],
		[false, true, legacyBookmarkListId]
	])('shows the only available list without a tab choice', (hasStandard, hasLegacy, expected) => {
		const tabs = getBookmarkListTabs(hasStandard, hasLegacy);

		expect(tabs).toHaveLength(1);
		expect(resolveSelectedBookmarkList(tabs, standardBookmarkListId)?.id).toBe(expected);
	});

	it('selects the standard list initially when both formats exist', () => {
		const tabs = getBookmarkListTabs(true, true);

		expect(tabs.map(({ id }) => id)).toEqual([standardBookmarkListId, legacyBookmarkListId]);
		expect(resolveSelectedBookmarkList(tabs, standardBookmarkListId)?.id).toBe(
			standardBookmarkListId
		);
	});

	it('switches to only the selected list and supports arrow-key navigation', () => {
		const tabs = getBookmarkListTabs(true, true);
		const next = getAdjacentBookmarkListTab(tabs, standardBookmarkListId, 1);

		expect(resolveSelectedBookmarkList(tabs, next?.id ?? '')?.id).toBe(legacyBookmarkListId);
		expect(getAdjacentBookmarkListTab(tabs, legacyBookmarkListId, -1)?.id).toBe(
			standardBookmarkListId
		);
	});
});
