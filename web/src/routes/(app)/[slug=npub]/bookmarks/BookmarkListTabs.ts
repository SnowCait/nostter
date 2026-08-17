export const standardBookmarkListId = 'standard';
export const legacyBookmarkListId = 'legacy';

export type BookmarkListTab = {
	id: string;
};

export function getBookmarkListTabs(hasLegacyBookmarks: boolean): BookmarkListTab[] {
	return [
		{ id: standardBookmarkListId },
		...(hasLegacyBookmarks ? [{ id: legacyBookmarkListId }] : [])
	];
}

export function getInitialBookmarkListId(
	hasStandardBookmarks: boolean,
	hasLegacyBookmarks: boolean
): string {
	return !hasStandardBookmarks && hasLegacyBookmarks
		? legacyBookmarkListId
		: standardBookmarkListId;
}

export function resolveSelectedBookmarkList(
	tabs: BookmarkListTab[],
	selectedId: string
): BookmarkListTab | undefined {
	return tabs.find(({ id }) => id === selectedId) ?? tabs[0];
}

export function getAdjacentBookmarkListTab(
	tabs: BookmarkListTab[],
	selectedId: string,
	offset: -1 | 1
): BookmarkListTab | undefined {
	const selectedIndex = tabs.findIndex(({ id }) => id === selectedId);
	if (selectedIndex === -1 || tabs.length === 0) {
		return tabs[0];
	}
	return tabs[(selectedIndex + offset + tabs.length) % tabs.length];
}
