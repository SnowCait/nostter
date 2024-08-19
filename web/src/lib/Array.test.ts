import { describe, it, expect } from 'vitest';
import { diff, unique } from './Array';

describe('array', () => {
	it('diff', () => {
		expect(diff([1, 2, 3], [3, 4])).toStrictEqual([1, 2]);
	});
	it('unique', () => {
		expect(unique([1, 2, 2, 3, 3, 3, 4])).toStrictEqual([1, 2, 3, 4]);
	});
});
