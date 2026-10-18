import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Event } from 'nostr-tools';
import { Contacts, Metadata, RelayList } from 'nostr-tools/kinds';
import type { UserEvent } from '../routes/types';
import * as eventOperations from './nostr/relay/event-operations';
import * as userEventStores from './stores/UserEvents';
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

afterEach(() => {
	vi.restoreAllMocks();
	userEventStores.userEvents.set(new Map());
});

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

describe('Api.fetchMetadataEventsMap', () => {
	it('fetches only uncached users and saves the latest metadata for each user', async () => {
		const cached = event(Metadata, 1) as UserEvent;
		userEventStores.userEvents.set(new Map([[pubkey, cached]]));
		const firstPubkey = 'b'.repeat(64);
		const secondPubkey = 'c'.repeat(64);
		const firstOlder = { ...event(Metadata, 2), pubkey: firstPubkey };
		const firstLatest = { ...event(Metadata, 4), pubkey: firstPubkey };
		const secondOlder = { ...event(Metadata, 3), pubkey: secondPubkey };
		const secondLatest = { ...event(Metadata, 5), pubkey: secondPubkey };
		const fetchEvents = vi
			.spyOn(eventOperations, 'fetchEvents')
			.mockResolvedValue([firstOlder, secondLatest, firstLatest, secondOlder]);
		const saveMetadataEvent = vi
			.spyOn(userEventStores, 'saveMetadataEvent')
			.mockResolvedValue(cached);

		const result = await new Api().fetchMetadataEventsMap([pubkey, firstPubkey, secondPubkey]);

		expect(fetchEvents).toHaveBeenCalledWith([
			{ kinds: [Metadata], authors: [firstPubkey, secondPubkey] }
		]);
		expect(result).toEqual(
			new Map<string, Event>([
				[pubkey, cached],
				[firstPubkey, firstLatest],
				[secondPubkey, secondLatest]
			])
		);
		expect(saveMetadataEvent.mock.calls.map(([event]) => event)).toEqual([
			cached,
			firstLatest,
			secondLatest
		]);
	});
});
