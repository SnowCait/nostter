import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Event } from 'nostr-tools';
import { ChannelCreation, ChannelMetadata, Contacts, Metadata, RelayList } from 'nostr-tools/kinds';
import { get } from 'svelte/store';
import {
	accountAddressableEventCache,
	cacheAccountEvent,
	cachedEvents,
	channelMetadataEventsStore
} from './cache/Events';
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

afterEach(async () => {
	await accountAddressableEventCache.clear();
	vi.restoreAllMocks();
	userEventStores.userEvents.set(new Map());
	cachedEvents.clear();
	channelMetadataEventsStore.set(new Map());
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
				latestRelayList,
				latestContacts,
				{ ...latestContacts, id: 'f'.repeat(64) },
				event(RelayList, 2),
				event(Contacts, 1)
			]);

		const result = await new Api().fetchRelayEvents(pubkey, on);

		expect(fetchEvents).toHaveBeenCalledWith(
			[{ kinds: [Contacts, RelayList], authors: [pubkey] }],
			on
		);
		expect(fetchEvents.mock.calls[0][1]).toBe(on);
		expect(result).toEqual(
			new Map([
				[RelayList, latestRelayList],
				[Contacts, latestContacts]
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

describe('Api.fetchChannelMetadataEvent', () => {
	it('selects and caches the kind 40 event when it is latest', async () => {
		const creation = event(ChannelCreation, 3);
		const id = creation.id;
		const metadata = { ...event(ChannelMetadata, 2), tags: [['e', id]] };
		const fetchEvents = vi
			.spyOn(eventOperations, 'fetchEvents')
			.mockResolvedValue([metadata, creation]);

		expect(await new Api().fetchChannelMetadataEvent(id)).toBe(creation);
		expect(fetchEvents).toHaveBeenCalledWith([
			{ kinds: [ChannelCreation], ids: [id], limit: 1 },
			{ kinds: [ChannelMetadata], '#e': [id], limit: 1 }
		]);
		expect(cachedEvents.get(id)).toBe(creation);
	});

	it('selects and caches the kind 41 event when latest, preferring the smaller ID on a tie', async () => {
		const id = event(ChannelCreation, 1).id;
		const creation = event(ChannelCreation, 1);
		const sameTimestamp = {
			...event(ChannelMetadata, 3),
			id: '2'.repeat(64),
			tags: [['e', id]]
		};
		const latest = { ...event(ChannelMetadata, 3), id: '1'.repeat(64), tags: [['e', id]] };
		const olderMetadata = { ...event(ChannelMetadata, 2), tags: [['e', id]] };
		const fetchEvents = vi
			.spyOn(eventOperations, 'fetchEvents')
			.mockResolvedValue([sameTimestamp, creation, latest, olderMetadata]);

		expect(await new Api().fetchChannelMetadataEvent(id)).toBe(latest);
		expect(fetchEvents).toHaveBeenCalledWith([
			{ kinds: [ChannelCreation], ids: [id], limit: 1 },
			{ kinds: [ChannelMetadata], '#e': [id], limit: 1 }
		]);
		expect(get(channelMetadataEventsStore).get(id)).toBe(latest);
	});
});

it('uses the cached user relay event for editing and sees newly saved settings', async () => {
	const fetchEvents = vi.spyOn(eventOperations, 'fetchEvents');
	const first = { ...event(RelayList, 1), tags: [['r', 'wss://reader.example', 'read']] };
	await cacheAccountEvent(first);
	expect((await new Api().fetchRelayEvents(pubkey, {})).get(RelayList)?.tags).toEqual(first.tags);
	const saved = { ...event(RelayList, 2), tags: [['r', 'wss://writer.example', 'write']] };
	await cacheAccountEvent(saved);
	expect((await new Api().fetchRelayEvents(pubkey, {})).get(RelayList)?.tags).toEqual(saved.tags);
	expect(fetchEvents).not.toHaveBeenCalled();
});
it('uses cached legacy kind 3 without reading effective relay permissions', async () => {
	const legacy = {
		...event(Contacts, 1),
		content: JSON.stringify({ 'wss://legacy.example': { read: true, write: false } })
	};
	await cacheAccountEvent(legacy);
	expect((await new Api().fetchRelayEvents(pubkey, {})).get(Contacts)).toEqual(legacy);
});
