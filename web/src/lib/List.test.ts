import { describe, expect, it } from 'vitest';
import { getListTitle } from './List';

describe('list', () => {
	it('title', () => {
		expect(
			getListTitle([
				['d', 'list1'],
				['title', 'title1']
			])
		).toStrictEqual('title1');
	});
	it('alt title', () => {
		expect(getListTitle([['d', 'list1']])).toStrictEqual('list1');
	});
});
