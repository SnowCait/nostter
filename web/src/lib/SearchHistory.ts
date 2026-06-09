export const maxSearchHistory = 100;

export function pushSearchHistory(history: string[], query: string): string[] {
	const trimmed = query.trim();
	if (trimmed.length === 0) {
		return history;
	}
	return [trimmed, ...history].slice(0, maxSearchHistory);
}

export function rankSearchHistory(history: string[]): string[] {
	const counts = new Map<string, number>();
	for (const query of history) {
		counts.set(query, (counts.get(query) ?? 0) + 1);
	}
	return [...counts].toSorted(([, x], [, y]) => y - x).map(([query]) => query);
}
