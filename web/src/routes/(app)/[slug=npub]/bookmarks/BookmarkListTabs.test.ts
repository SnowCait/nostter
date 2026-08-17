import { describe, expect, it } from 'vitest';
import {
	getAdjacentBookmarkListTab,
	getBookmarkListTabs,
	getInitialBookmarkListId,
	legacyBookmarkListId,
	resolveSelectedBookmarkList,
	standardBookmarkListId
} from './BookmarkListTabs';

describe('Bookmark list tabs', () => {
	it.each([
		[false, false, [standardBookmarkListId], standardBookmarkListId],
		[true, false, [standardBookmarkListId], standardBookmarkListId],
		[false, true, [standardBookmarkListId, legacyBookmarkListId], legacyBookmarkListId],
		[true, true, [standardBookmarkListId, legacyBookmarkListId], standardBookmarkListId]
	])(
		'builds tabs and selects the initial list for standard=%s legacy=%s',
		(hasStandard, hasLegacy, expectedTabs, expectedSelection) => {
			const tabs = getBookmarkListTabs(hasLegacy);
			const initialId = getInitialBookmarkListId(hasStandard, hasLegacy);

			expect(tabs.map(({ id }) => id)).toEqual(expectedTabs);
			expect(resolveSelectedBookmarkList(tabs, initialId)?.id).toBe(expectedSelection);
		}
	);

	it('switches to only the selected list and supports arrow-key navigation', () => {
		const tabs = getBookmarkListTabs(true);
		const next = getAdjacentBookmarkListTab(tabs, standardBookmarkListId, 1);

		expect(resolveSelectedBookmarkList(tabs, next?.id ?? '')?.id).toBe(legacyBookmarkListId);
		expect(getAdjacentBookmarkListTab(tabs, legacyBookmarkListId, -1)?.id).toBe(
			standardBookmarkListId
		);
	});
});
