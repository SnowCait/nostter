import { describe, expect, it } from 'vitest';
import { getReactionTargetEventId } from './nip25';

const targetId1 = 'a'.repeat(64);
const targetId2 = 'b'.repeat(64);

describe('getReactionTargetEventId', () => {
	it('returns a single valid event ID', () => {
		expect(getReactionTargetEventId([['e', targetId1]])).toBe(targetId1);
	});

	it('returns the last valid event ID of multiple e tags', () => {
		expect(
			getReactionTargetEventId([
				['e', targetId1],
				['e', targetId2]
			])
		).toBe(targetId2);
	});

	it('ignores an empty value', () => {
		expect(
			getReactionTargetEventId([
				['e', ''],
				['e', targetId1]
			])
		).toBe(targetId1);
	});

	it('ignores a missing value', () => {
		expect(getReactionTargetEventId([['e'], ['e', targetId1]])).toBe(targetId1);
	});

	it('ignores a non-hex value', () => {
		expect(
			getReactionTargetEventId([
				['e', 'g'.repeat(64)],
				['e', targetId1]
			])
		).toBe(targetId1);
	});

	it('ignores 63-character and 65-character values', () => {
		expect(
			getReactionTargetEventId([
				['e', 'a'.repeat(63)],
				['e', targetId1]
			])
		).toBe(targetId1);
		expect(
			getReactionTargetEventId([
				['e', 'a'.repeat(65)],
				['e', targetId1]
			])
		).toBe(targetId1);
	});

	it('ignores an uppercase hex value', () => {
		expect(
			getReactionTargetEventId([
				['e', 'A'.repeat(64)],
				['e', targetId1]
			])
		).toBe(targetId1);
	});

	it('returns an earlier valid event ID when the last e tag is invalid', () => {
		expect(
			getReactionTargetEventId([
				['e', targetId1],
				['e', 'invalid']
			])
		).toBe(targetId1);
	});

	it('returns undefined when there is no valid event ID', () => {
		expect(getReactionTargetEventId([])).toBe(undefined);
		expect(getReactionTargetEventId([['e', '']])).toBe(undefined);
		expect(getReactionTargetEventId([['e']])).toBe(undefined);
		expect(getReactionTargetEventId([['e', 'g'.repeat(64)]])).toBe(undefined);
		expect(getReactionTargetEventId([['e', 'A'.repeat(64)]])).toBe(undefined);
	});

	it('ignores non-e tags', () => {
		expect(
			getReactionTargetEventId([
				['p', targetId1],
				['t', targetId1]
			])
		).toBe(undefined);
	});
});
