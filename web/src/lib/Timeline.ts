import { Kind, SimplePool } from 'nostr-tools';
import { readRelays, updateRelays, author } from '../stores/Author';
import { pool } from '../stores/Pool';
import { Api } from './Api';
import { get } from 'svelte/store';
import { EventItem } from './Items';
import type { Filter, Event as NostrEvent } from 'nostr-tools';
import type { Event } from '../routes/types';
import { saveMetadataEvent } from '../stores/UserEvents';
import { userTimelineEvents } from '../stores/Events';
import { chunk } from './Array';
import { filterLimitItems } from './Constants';
import { Content } from './Content';
import { referencesReqEmit } from './timelines/MainTimeline';

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

		const $author = get(author);

		const authorsFilter = chunk(this.authors, filterLimitItems).map((chunkedAuthors) => {
			return {
				kinds: [Kind.Metadata, Kind.Text, 6, Kind.ChannelCreation, Kind.ChannelMessage],
				authors: chunkedAuthors,
				since
			};
		});

		const filters: Filter[] = [
			...authorsFilter,
			{
				kinds: [
					Kind.Text /*, Kind.EncryptedDirectMessage*/,
					6,
					/*Kind.Reaction,*/ Kind.ChannelMessage /*, Kind.Zap*/
				],
				'#p': [this.pubkey],
				since
			}
			// {
			// 	kinds: [Kind.Reaction /*, Kind.RelayList, 10030*/],
			// 	authors: [this.pubkey],
			// 	since
			// }
		];
		console.log('[new timeline filters]', filters);

		const subscribe = this.$pool.sub(this.$readRelays, filters);
		subscribe.on('event', async (nostrEvent: NostrEvent) => {
			const event = nostrEvent as Event;
			console.debug('[user timeline]', event, this.$pool.seenOn(event.id));

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
				$author?.storeCustomEmojis(event);
				return;
			}

			referencesReqEmit(event);

			// Cache note events
			const eventIds = new Set([
				...event.tags.filter(([tagName]) => tagName === 'e').map(([, id]) => id),
				...Content.findNotesAndNeventsToIds(event.content)
			]);
			await this.api.fetchEventsByIds([...eventIds]);

			// // Streaming speed (experimental)
			// notifyStreamingSpeed(event.created_at);

			// // Notification
			// if ($author?.isNotified(event)) {
			// 	console.log('[related]', event);
			// 	notify(event);
			// }

			const events = get(userTimelineEvents);
			events.unshift(new EventItem(event));
			userTimelineEvents.set(events);
		});
		return () => {
			console.log('[user timeline unsub]', subscribe);
			subscribe.unsub();
		};
	}

	public static createChunkedFilters(authors: string[], since: number, until: number): Filter[] {
		return chunk(authors, filterLimitItems).map((chunkedAuthors) => {
			return {
				kinds: [Kind.Text, 6, Kind.ChannelCreation, Kind.ChannelMessage, 30315],
				authors: chunkedAuthors,
				until,
				since
			};
		});
	}
}
