import { Kind } from 'nostr-tools';
import {
	isMuteEvent,
	readRelays,
	pubkey as authorPubkey,
	followees as authorFollowees
} from '../stores/Author';
import { pool } from '../stores/Pool';
import { Api } from './Api';
import { get } from 'svelte/store';
import { EventItem } from './Items';

export class Timeline {
	constructor(private readonly pubkey: string) {}

	public subscribe() {
		// TODO: Implement
	}

	public async fetch(until: number | undefined = undefined): Promise<EventItem[]> {
		const $pool = get(pool);
		const $readRelays = get(readRelays);

		const now = Math.floor(Date.now() / 1000);
		const span = 1 * 60 * 60;
		const since = (until ?? now) - span;
		console.log('[date]', new Date(since * 1000));

		const api = new Api($pool, $readRelays);

		const followees =
			this.pubkey === get(authorPubkey)
				? get(authorFollowees)
				: await api.fetchFollowees(this.pubkey);

		const events = await api.fetchEvents([
			{
				kinds: [Kind.Text, 6, Kind.ChannelCreation, Kind.ChannelMessage],
				authors: followees,
				until,
				since
			},
			{
				kinds: [Kind.Text, Kind.EncryptedDirectMessage, 6, Kind.Reaction, Kind.Zap],
				'#p': [this.pubkey],
				until,
				since
			},
			{
				kinds: [Kind.Reaction],
				authors: [this.pubkey],
				until,
				since
			}
		]);
		events.sort((x, y) => y.created_at - x.created_at);

		const metadataEventsMap = await api.fetchMetadataEventsMap(
			Array.from(new Set(events.map((x) => x.pubkey)))
		);

		// Cache note events
		const eventIds = new Set(
			events
				.map((x) => x.tags.filter(([tagName]) => tagName === 'e').map(([, id]) => id))
				.flat()
		);
		await api.fetchEventsByIds([...eventIds]);

		return events
			.filter((event) => !isMuteEvent(event))
			.map((event) => {
				const metadataEvent = metadataEventsMap.get(event.pubkey);
				return new EventItem(event, metadataEvent);
			});
	}
}
