export const maxSearchHistory = 100;

export function pushSearchHistory(history: string[], keyword: string): string[] {
	const trimmed = keyword.trim();
	if (trimmed.length === 0) {
		return history;
	}
	return [trimmed, ...history].slice(0, maxSearchHistory);
}

export function rankSearchHistory(history: string[]): string[] {
	const counts = new Map<string, number>();
	for (const keyword of history) {
		counts.set(keyword, (counts.get(keyword) ?? 0) + 1);
	}
	return [...counts].toSorted(([, x], [, y]) => y - x).map(([keyword]) => keyword);
}
