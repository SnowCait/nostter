import { get } from 'svelte/store';
import { Kind, type SimplePool } from 'nostr-tools';
import { Api } from './Api';
import { filterTags } from './EventHelper';
import { followees, originalFollowees, pubkey } from './stores/Author';
import { sendEvent } from './RxNostrHelper';

export class Contacts {
	private readonly api: Api;

	constructor(
		private readonly authorPubkey: string,
		pool: SimplePool,
		writeRelays: string[]
	) {
		this.api = new Api(pool, writeRelays);
	}

	// For legacy clients
	public async updateRelays(
		relays: Map<string, { read: boolean; write: boolean }>
	): Promise<void> {
		const contacts = await this.api.fetchContactsEvent(this.authorPubkey, {
			defaultWriteRelays: true
		});
		console.log('[contacts]', contacts);

		if (contacts === undefined) {
			console.log('[contacts not found]');
			return;
		}

		const content = JSON.stringify(Object.fromEntries(relays));
		if (content === contacts.content) {
			console.log('[relays not changed]');
			return;
		}

		await sendEvent(Kind.Contacts, content, contacts.tags);
	}
}

export function updateFolloweesStore(tags: string[][]): void {
	const pubkeys = new Set(filterTags('p', tags).filter((pubkey) => /[0-9a-z]{64}/.test(pubkey)));
	originalFollowees.set([...pubkeys]);
	pubkeys.add(get(pubkey)); // Add myself
	followees.set([...pubkeys]);
	console.log('[contacts]', pubkeys.size);
}
