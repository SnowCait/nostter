import { describe, expect, it } from 'vitest';
import { notificationsFilterKinds } from '$lib/Constants';
import { createNotificationFilter } from './create-notification-filter';

describe('createNotificationFilter', () => {
	it.each(['', 'a'.repeat(63), 'a'.repeat(65), 'A'.repeat(64), 'g'.repeat(64), undefined, null])(
		'does not create a filter for an invalid pubkey: %s',
		(pubkey) => {
			expect(createNotificationFilter(pubkey, 100, 200)).toBeUndefined();
		}
	);

	it('uses a valid lowercase hex pubkey in the #p filter', () => {
		const pubkey = '0123456789abcdef'.repeat(4);

		expect(createNotificationFilter(pubkey, 100, 200)).toEqual({
			kinds: notificationsFilterKinds,
			'#p': [pubkey],
			until: 200,
			since: 100
		});
	});
});
