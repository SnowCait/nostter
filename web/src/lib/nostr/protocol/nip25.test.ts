import { describe, expect, it } from 'vitest';
import { getReactionTargetEventId } from './nip25';

describe('getReactionTargetEventId', () => {
	it('returns the value of a single valid e tag', () => {
		expect(getReactionTargetEventId([['e', 'target1']])).toBe('target1');
	});

	it('returns the last value of multiple valid e tags', () => {
		expect(
			getReactionTargetEventId([
				['e', 'target1'],
				['e', 'target2']
			])
		).toBe('target2');
	});

	it('ignores an empty string e tag', () => {
		expect(
			getReactionTargetEventId([
				['e', ''],
				['e', 'target1']
			])
		).toBe('target1');
	});

	it('ignores an e tag without content', () => {
		expect(getReactionTargetEventId([['e'], ['e', 'target1']])).toBe('target1');
	});

	it('returns undefined when there is no valid e tag', () => {
		expect(getReactionTargetEventId([])).toBe(undefined);
		expect(getReactionTargetEventId([['e', '']])).toBe(undefined);
		expect(getReactionTargetEventId([['e']])).toBe(undefined);
	});

	it('ignores non-e tags', () => {
		expect(
			getReactionTargetEventId([
				['p', 'target1'],
				['t', 'target2']
			])
		).toBe(undefined);
	});
});
