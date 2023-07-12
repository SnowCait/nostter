import { Kind, SimplePool } from 'nostr-tools';
import { isMuteEvent, readRelays, bookmarkEvent, updateRelays, author } from '../stores/Author';
import { pool } from '../stores/Pool';
import { Api } from './Api';
import { get } from 'svelte/store';
import { EventItem } from './Items';
import type { Filter, Event as NostrEvent } from 'nostr-tools';
import type { Event } from '../routes/types';
import { saveMetadataEvent } from '../stores/UserEvents';
import { userTimelineEvents } from '../stores/Events';
import { chunk } from './Array';

export class Timeline {
	private readonly $pool: SimplePool;
	private readonly $readRelays: string[];
	private readonly api: Api;

	constructor(private readonly pubkey: string, private readonly authors: string[]) {
		this.$pool = get(pool);
		this.$readRelays = get(readRelays);
		this.api = new Api(this.$pool, this.$readRelays);
	}

	public async subscribe(): Promise<() => void> {
		const now = Math.floor(Date.now() / 1000);
		const since = now;

		// const $bookmarkEvent = get(bookmarkEvent);
		const $author = get(author);

		const authorsFilter = chunk(this.authors, 1000).map((chunkedAuthors) => {
			return {
				kinds: [Kind.Metadata, Kind.Text, 6, Kind.ChannelCreation, Kind.ChannelMessage],
				authors: chunkedAuthors,
				since
			};
		});

		const filters: Filter[] = [
			...authorsFilter,
			{
				kinds: [Kind.Text /*, Kind.EncryptedDirectMessage*/, 6 /*Kind.Reaction, Kind.Zap*/],
				'#p': [this.pubkey],
				since
			}
			// {
			// 	kinds: [Kind.Reaction /*, Kind.RelayList, 10030*/],
			// 	authors: [this.pubkey],
			// 	since
			// }
			// {
			// 	kinds: [30001],
			// 	authors: [this.pubkey],
			// 	'#d': ['bookmark'],
			// 	since: $bookmarkEvent === undefined ? now : $bookmarkEvent.created_at + 1
			// }
		];
		console.log('[new timeline filters]', filters);

		const subscribe = this.$pool.sub(this.$readRelays, filters);
		subscribe.on('event', async (nostrEvent: NostrEvent) => {
			const event = nostrEvent as Event;
			console.debug('[user timeline]', event, this.$pool.seenOn(event.id));

			if (isMuteEvent(event)) {
				return;
			}

			if (event.kind === Kind.Metadata) {
				await saveMetadataEvent(event);
				return;
			}

			if (event.kind === Kind.RelayList) {
				console.log('[relay list]', event, this.$pool.seenOn(event.id));
				updateRelays(event);
				return;
			}

			if (event.kind === 10030) {
				$author?.saveCustomEmojis(event);
				return;
			}

			if (
				event.kind === 30001 &&
				event.tags.some(
					([tagName, identifier]) => tagName === 'd' && identifier === 'bookmark'
				)
			) {
				console.log('[bookmark]', event, this.$pool.seenOn(event.id));
				bookmarkEvent.set(event);
				return;
			}

			const userEvent = await this.api.fetchUserEvent(event.pubkey); // not chronological
			if (userEvent !== undefined) {
				event.user = userEvent.user;
			}

			// // Streaming speed (experimental)
			// notifyStreamingSpeed(event.created_at);

			// // Notification
			// if ($author?.isNotified(event)) {
			// 	console.log('[related]', event);
			// 	notify(event);
			// }

			const events = get(userTimelineEvents);
			events.unshift(event);
			userTimelineEvents.set(events);

			// // Cache
			// if (event.kind === Kind.Text) {
			// 	saveLastNote(event);
			// }
		});
		return () => {
			console.log('[user timeline unsub]', subscribe);
			subscribe.unsub();
		};
	}

	public async fetch(until: number, seconds: number = 1 * 60 * 60): Promise<EventItem[]> {
		const since = until - seconds;

		const authorsFilter = chunk(this.authors, 1000).map((chunkedAuthors) => {
			return {
				kinds: [Kind.Text, 6, Kind.ChannelCreation, Kind.ChannelMessage],
				authors: chunkedAuthors,
				since
			};
		});

		const filters = [
			...authorsFilter,
			{
				kinds: [
					Kind.Text /*, Kind.EncryptedDirectMessage*/,
					6 /*, Kind.Reaction, Kind.Zap*/
				],
				'#p': [this.pubkey],
				until,
				since
			}
			// {
			// 	kinds: [Kind.Reaction],
			// 	authors: [this.pubkey],
			// 	until,
			// 	since
			// }
		];
		console.log('[past timeline filters]', filters);

		const events = await this.api.fetchEvents(filters);

		const metadataEventsMap = await this.api.fetchMetadataEventsMap(
			Array.from(new Set(events.map((x) => x.pubkey)))
		);

		// Cache note events
		const eventIds = new Set(
			events
				.map((x) => x.tags.filter(([tagName]) => tagName === 'e').map(([, id]) => id))
				.flat()
		);
		await this.api.fetchEventsByIds([...eventIds]);

		const eventItems = events
			.filter((event) => event.created_at !== until)
			.filter((event) => !isMuteEvent(event))
			.map((event) => {
				const metadataEvent = metadataEventsMap.get(event.pubkey);
				return new EventItem(event, metadataEvent);
			});
		eventItems.sort((x, y) => y.event.created_at - x.event.created_at);
		return eventItems;
	}
}
