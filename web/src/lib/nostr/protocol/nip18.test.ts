import { describe, expect, it } from 'vitest';
import { getRepostTargetEventId } from './nip18';

describe('getRepostTargetEventId', () => {
	it('returns the value of a single valid e tag', () => {
		expect(getRepostTargetEventId([['e', 'target1']])).toBe('target1');
	});

	it('returns the last value of multiple valid e tags', () => {
		expect(
			getRepostTargetEventId([
				['e', 'target1'],
				['e', 'target2']
			])
		).toBe('target2');
	});

	it('ignores an empty string e tag', () => {
		expect(
			getRepostTargetEventId([
				['e', ''],
				['e', 'target1']
			])
		).toBe('target1');
	});

	it('ignores an e tag without content', () => {
		expect(getRepostTargetEventId([['e'], ['e', 'target1']])).toBe('target1');
	});

	it('returns undefined when there is no valid e tag', () => {
		expect(getRepostTargetEventId([])).toBe(undefined);
		expect(getRepostTargetEventId([['e', '']])).toBe(undefined);
		expect(getRepostTargetEventId([['e']])).toBe(undefined);
	});

	it('ignores non-e tags', () => {
		expect(
			getRepostTargetEventId([
				['p', 'target1'],
				['t', 'target2']
			])
		).toBe(undefined);
	});
});
