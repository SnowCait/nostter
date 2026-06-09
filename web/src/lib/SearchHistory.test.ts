import { describe, it, expect } from 'vitest';
import { maxSearchHistory, pushSearchHistory, rankSearchHistory } from './SearchHistory';

describe('pushSearchHistory', () => {
	it('prepends the keyword as the most recent entry', () => {
		expect(pushSearchHistory(['a'], 'b')).toStrictEqual(['b', 'a']);
	});
	it('trims surrounding whitespace', () => {
		expect(pushSearchHistory([], '  hello  ')).toStrictEqual(['hello']);
	});
	it('ignores empty or whitespace-only keywords', () => {
		expect(pushSearchHistory(['a'], '')).toStrictEqual(['a']);
		expect(pushSearchHistory(['a'], '   ')).toStrictEqual(['a']);
	});
	it('keeps duplicates so frequency can be counted', () => {
		expect(pushSearchHistory(['a'], 'a')).toStrictEqual(['a', 'a']);
	});
	it('caps the history at maxSearchHistory entries', () => {
		const full = Array.from({ length: maxSearchHistory }, (_, i) => String(i));
		const result = pushSearchHistory(full, 'new');
		expect(result.length).toBe(maxSearchHistory);
		expect(result[0]).toBe('new');
		expect(result.at(-1)).toBe(String(maxSearchHistory - 2));
	});
});

describe('rankSearchHistory', () => {
	it('orders keywords by frequency descending', () => {
		expect(rankSearchHistory(['a', 'b', 'a', 'c', 'a', 'b'])).toStrictEqual(['a', 'b', 'c']);
	});
	it('breaks ties by most recent (insertion) order', () => {
		expect(rankSearchHistory(['recent', 'old'])).toStrictEqual(['recent', 'old']);
	});
	it('returns unique keywords', () => {
		expect(rankSearchHistory(['a', 'a', 'a'])).toStrictEqual(['a']);
	});
	it('returns an empty array for empty history', () => {
		expect(rankSearchHistory([])).toStrictEqual([]);
	});
});
