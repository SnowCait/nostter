import { describe, expect, it } from 'vitest';
import type * as Nostr from 'nostr-typedef';
import { isNotificationEvent } from './is-notification-event';

const accountPubkey = 'account-pubkey';

function event(pubkey: string, tags: string[][]): Nostr.Event {
	return {
		id: 'event-id',
		pubkey,
		created_at: 1,
		kind: 1,
		tags,
		content: '',
		sig: ''
	};
}

describe('isNotificationEvent', () => {
	it('matches another author event that mentions the account', () => {
		expect(
			isNotificationEvent(event('another-pubkey', [['p', accountPubkey]]), accountPubkey)
		).toBe(true);
	});

	it('does not match an event authored by the account', () => {
		expect(
			isNotificationEvent(event(accountPubkey, [['p', accountPubkey]]), accountPubkey)
		).toBe(false);
	});

	it('does not match an event without an account p tag', () => {
		expect(
			isNotificationEvent(event('another-pubkey', [['e', accountPubkey]]), accountPubkey)
		).toBe(false);
	});

	it('does not match an event that only mentions another pubkey', () => {
		expect(
			isNotificationEvent(event('another-pubkey', [['p', 'different-pubkey']]), accountPubkey)
		).toBe(false);
	});
});
