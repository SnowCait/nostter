import { describe, expect, it } from 'vitest';
import { getRepostTargetEventId } from './nip18';

const targetId1 = 'a'.repeat(64);
const targetId2 = 'b'.repeat(64);

describe('getRepostTargetEventId', () => {
	it('returns a single valid event ID', () => {
		expect(getRepostTargetEventId([['e', targetId1]])).toBe(targetId1);
	});

	it('returns the last valid event ID of multiple e tags', () => {
		expect(
			getRepostTargetEventId([
				['e', targetId1],
				['e', targetId2]
			])
		).toBe(targetId2);
	});

	it('ignores an empty value', () => {
		expect(
			getRepostTargetEventId([
				['e', ''],
				['e', targetId1]
			])
		).toBe(targetId1);
	});

	it('ignores a missing value', () => {
		expect(getRepostTargetEventId([['e'], ['e', targetId1]])).toBe(targetId1);
	});

	it('ignores a non-hex value', () => {
		expect(
			getRepostTargetEventId([
				['e', 'g'.repeat(64)],
				['e', targetId1]
			])
		).toBe(targetId1);
	});

	it('ignores 63-character and 65-character values', () => {
		expect(
			getRepostTargetEventId([
				['e', 'a'.repeat(63)],
				['e', targetId1]
			])
		).toBe(targetId1);
		expect(
			getRepostTargetEventId([
				['e', 'a'.repeat(65)],
				['e', targetId1]
			])
		).toBe(targetId1);
	});

	it('ignores an uppercase hex value', () => {
		expect(
			getRepostTargetEventId([
				['e', 'A'.repeat(64)],
				['e', targetId1]
			])
		).toBe(targetId1);
	});

	it('returns an earlier valid event ID when the last e tag is invalid', () => {
		expect(
			getRepostTargetEventId([
				['e', targetId1],
				['e', 'invalid']
			])
		).toBe(targetId1);
	});

	it('returns undefined when there is no valid event ID', () => {
		expect(getRepostTargetEventId([])).toBe(undefined);
		expect(getRepostTargetEventId([['e', '']])).toBe(undefined);
		expect(getRepostTargetEventId([['e']])).toBe(undefined);
		expect(getRepostTargetEventId([['e', 'g'.repeat(64)]])).toBe(undefined);
		expect(getRepostTargetEventId([['e', 'A'.repeat(64)]])).toBe(undefined);
	});

	it('ignores non-e tags', () => {
		expect(
			getRepostTargetEventId([
				['p', targetId1],
				['t', targetId1]
			])
		).toBe(undefined);
	});
});
