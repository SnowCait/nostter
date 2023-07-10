import { Kind, SimplePool } from 'nostr-tools';
import {
	isMuteEvent,
	readRelays,
	pubkey as authorPubkey,
	followees as authorFollowees,
	bookmarkEvent,
	updateRelays,
	author
} from '../stores/Author';
import { pool } from '../stores/Pool';
import { Api } from './Api';
import { get } from 'svelte/store';
import { EventItem } from './Items';
import type { Filter, Event as NostrEvent } from 'nostr-tools';
import type { Event } from '../routes/types';
import { saveMetadataEvent } from '../stores/UserEvents';
import { userTimelineEvents } from '../stores/Events';

export class Timeline {
	private readonly $pool: SimplePool;
	private readonly $readRelays: string[];
	private readonly api: Api;

	constructor(private readonly pubkey: string) {
		this.$pool = get(pool);
		this.$readRelays = get(readRelays);
		this.api = new Api(this.$pool, this.$readRelays);
	}

	public async subscribe(): Promise<() => void> {
		const now = Math.floor(Date.now() / 1000);
		const since = now;

		const followees = await this.getFollowees();
		// const $bookmarkEvent = get(bookmarkEvent);
		const $author = get(author);

		const filters: Filter[] = [
			{
				kinds: [Kind.Metadata, Kind.Text, 6, Kind.ChannelCreation, Kind.ChannelMessage],
				authors: followees,
				since
			},
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

	public async fetch(until: number | undefined = undefined): Promise<EventItem[]> {
		const now = Math.floor(Date.now() / 1000);
		const span = 1 * 60 * 60;
		const since = (until ?? now) - span;
		console.log('[date]', new Date(since * 1000));

		const followees = await this.getFollowees();

		const events = await this.api.fetchEvents([
			{
				kinds: [Kind.Text, 6, Kind.ChannelCreation, Kind.ChannelMessage],
				authors: followees,
				until,
				since
			},
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
		]);
		events.sort((x, y) => y.created_at - x.created_at);

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

		return events
			.filter((event) => !isMuteEvent(event))
			.map((event) => {
				const metadataEvent = metadataEventsMap.get(event.pubkey);
				return new EventItem(event, metadataEvent);
			});
	}

	private async getFollowees(): Promise<string[]> {
		return this.pubkey === get(authorPubkey)
			? get(authorFollowees)
			: await this.api.fetchFollowees(this.pubkey);
	}
}
