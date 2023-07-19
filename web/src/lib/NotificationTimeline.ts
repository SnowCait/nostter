import { Kind } from 'nostr-tools';
import { get } from 'svelte/store';
import { Api } from './Api';
import { pool } from '../stores/Pool';
import { isMuteEvent, readRelays } from '../stores/Author';

export class NotificationTimeline {
	private readonly api: Api;

	constructor(private readonly pubkey: string) {
		const $pool = get(pool);
		const $readRelays = get(readRelays);
		this.api = new Api($pool, $readRelays);
	}

	public async fetch(until: number, since: number) {
		const filter = {
			kinds: [Kind.Text, Kind.EncryptedDirectMessage, 6, Kind.Reaction, Kind.Zap],
			'#p': [this.pubkey],
			until,
			since
		};
		console.debug(
			'[notification filter]',
			filter,
			new Date(until * 1000),
			new Date(since * 1000)
		);
		const eventItems = await this.api.fetchEventItems([filter]);
		console.debug('[notification events]', eventItems);
		return eventItems
			.filter((x) => x.event.created_at !== until)
			.filter((x) => !isMuteEvent(x.event));
	}
}
