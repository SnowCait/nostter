import { kinds as Kind } from 'nostr-tools';
import { Api } from './Api';
import { auth } from './auth.svelte';
import { sendEvent } from './RxNostrHelper';
import { pruneFolloweeReplaceableEventsCache } from './cache/Events';

export class Contacts {
	private readonly api: Api;

	constructor(private readonly authorPubkey: string) {
		this.api = new Api();
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
	auth.updateFollowees(tags);
	pruneFolloweeReplaceableEventsCache(auth.followees);
}
