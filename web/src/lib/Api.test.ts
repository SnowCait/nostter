import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Event } from 'nostr-tools';
import { Contacts, RelayList } from 'nostr-tools/kinds';
import * as eventOperations from './nostr/relay/event-operations';
import { Api } from './Api';

const pubkey = 'a'.repeat(64);

function event(kind: number, created_at: number): Event {
	return {
		id: `${kind}-${created_at}`.padStart(64, '0'),
		pubkey,
		kind,
		created_at,
		tags: [],
		content: '',
		sig: ''
	};
}

afterEach(() => vi.restoreAllMocks());

describe('Api.fetchRelayEvents', () => {
	it('fetches relay events with the given scope and selects the latest event per kind', async () => {
		const on = {
			relays: ['wss://relay.example.com'],
			defaultReadRelays: true,
			defaultWriteRelays: false
		};
		const latestContacts = event(Contacts, 3);
		const latestRelayList = event(RelayList, 4);
		const fetchEvents = vi
			.spyOn(eventOperations, 'fetchEvents')
			.mockResolvedValue([
				latestContacts,
				latestRelayList,
				event(Contacts, 1),
				event(RelayList, 2)
			]);

		const result = await new Api().fetchRelayEvents(pubkey, on);

		expect(fetchEvents).toHaveBeenCalledWith(
			[{ kinds: [Contacts, RelayList], authors: [pubkey] }],
			on
		);
		expect(fetchEvents.mock.calls[0][1]).toBe(on);
		expect(result).toEqual(
			new Map([
				[Contacts, latestContacts],
				[RelayList, latestRelayList]
			])
		);
	});
});
