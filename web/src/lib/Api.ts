import { nip19, type Event, type SimplePool, Kind, type Filter } from 'nostr-tools';
import { get } from 'svelte/store';
import { saveMetadataEvent, userEvents } from './stores/UserEvents';
import { channelMetadataEventsStore } from './cache/Events';
import { cachedEvents as newCachedEvents } from './cache/Events';
import { chronological, reverseChronological } from './Constants';

export class Api {
	constructor(
		private pool: SimplePool,
		private relays: string[]
	) {}

	public async fetchRelayEvents(pubkey: string): Promise<Map<Kind, Event>> {
		const events = await this.pool.list(this.relays, [
			{
				kinds: [Kind.Contacts, Kind.RelayList],
				authors: [pubkey]
			}
		]);
		events.sort(chronological); // Latest event is effective
		console.debug('[relay events all]', events);
		return new Map<Kind, Event>(events.map((e) => [e.kind, e]));
	}

	async fetchMetadataEventsMap(pubkeys: string[]): Promise<Map<string, Event>> {
		const eventsMap = new Map<string, Event>();

		if (pubkeys.length === 0) {
			return eventsMap;
		}

		const $userEvents = get(userEvents);
		for (const pubkey of pubkeys) {
			const userEvent = $userEvents.get(pubkey);
			if (userEvent !== undefined) {
				eventsMap.set(pubkey, userEvent as Event);
			}
		}

		if (pubkeys.length === eventsMap.size) {
			return eventsMap;
		}

		const events = await this.pool.list(this.relays, [
			{
				kinds: [Kind.Metadata],
				authors: pubkeys.filter((pubkey) => !eventsMap.has(pubkey))
			}
		]);

		for (const event of events) {
			const cache = eventsMap.get(event.pubkey);
			if (cache === undefined || cache.created_at < event.created_at) {
				eventsMap.set(event.pubkey, event);
			}
		}

		await Promise.all([...eventsMap].map(async ([, event]) => await saveMetadataEvent(event)));

		return eventsMap;
	}

	async fetchEvent(filters: Filter[]): Promise<Event | undefined> {
		const events = await this.pool.list(this.relays, filters);

		// Latest (return multi events except id filter)
		events.sort(reverseChronological);
		return events.at(0);
	}

	async fetchContactsEvent(pubkey: string): Promise<Event | undefined> {
		const events = await this.pool.list(this.relays, [
			{
				kinds: [3],
				authors: [pubkey],
				limit: 1 // Some relays have duplicate kind 3
			}
		]);
		events.sort(reverseChronological);
		console.log('[contact list events]', events);
		return events.at(0);
	}

	async fetchEvents(filters: Filter[]): Promise<Event[]> {
		return this.pool.list(this.relays, filters);
	}

	async fetchFollowees(pubkey: string): Promise<string[]> {
		const event = await this.fetchContactsEvent(pubkey);
		return Array.from(
			new Set(
				event?.tags.filter(([tagName]) => tagName === 'p').map(([, pubkey]) => pubkey) ?? []
			)
		);
	}

	/**
	 * @param id kind 40 id
	 * @returns kind 40 or 41 event
	 */
	async fetchChannelMetadataEvent(id: string): Promise<Event | undefined> {
		const $channelMetadataEventsStore = get(channelMetadataEventsStore);
		const cache = $channelMetadataEventsStore.get(id) ?? newCachedEvents.get(id);
		if (cache !== undefined) {
			console.debug('[channel metadata events cache]', cache);
			return cache;
		}

		const events = await this.pool.list(this.relays, [
			{
				kinds: [Kind.ChannelCreation],
				ids: [id],
				limit: 1
			},
			{
				kinds: [Kind.ChannelMetadata],
				'#e': [id],
				limit: 1
			}
		]);
		events.sort(reverseChronological);
		console.debug('[channel metadata events]', events);
		const event = events.at(0);
		if (event !== undefined) {
			if (event.kind === Kind.ChannelCreation) {
				newCachedEvents.set(id, event);
			} else if (event.kind === Kind.ChannelMetadata) {
				$channelMetadataEventsStore.set(id, event);
				channelMetadataEventsStore.set($channelMetadataEventsStore);
			} else {
				console.error('[channel metadata logic error]', event);
			}
		}
		return event;
	}

	close() {
		console.debug('[close connections]', this.relays);
		this.pool.close(this.relays);
	}
}

export const fetchEvent = async (id: string, relays: string[]): Promise<Event | undefined> => {
	console.debug('[api request id]', id, relays);
	const response = await fetch(`https://api.nostter.app/${nip19.neventEncode({ id, relays })}`, {
		headers: {
			'User-Agent': 'nostter'
		}
	});
	if (!response.ok) {
		console.warn('[api event not found]', await response.text());
		return undefined;
	}
	const event = (await response.json()) as Event;
	console.debug('[api response]', event);
	return event;
};

export const fetchMetadata = async (
	pubkey: string,
	relays: string[]
): Promise<Event | undefined> => {
	console.debug('[api request pubkey]', pubkey, relays);
	const response = await fetch(
		`https://api.nostter.app/${nip19.nprofileEncode({ pubkey, relays })}`,
		{
			headers: {
				'User-Agent': 'nostter'
			}
		}
	);
	if (!response.ok) {
		console.warn('[api metadata not found]', await response.text());
		return undefined;
	}
	const event = (await response.json()) as Event;
	console.debug('[api response]', event);
	return event;
};
