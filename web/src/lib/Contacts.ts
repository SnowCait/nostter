import { Kind, type SimplePool } from 'nostr-tools';
import { Api } from './Api';

export class Contacts {
	private readonly api: Api;

	constructor(private readonly authorPubkey: string, pool: SimplePool, writeRelays: string[]) {
		this.api = new Api(pool, writeRelays);
	}

	// For regacy clients
	public async updateRelays(
		relays: Map<string, { read: boolean; write: boolean }>
	): Promise<void> {
		const contacts = await this.api.fetchContactListEvent(this.authorPubkey);
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

		await this.api.signAndPublish(Kind.Contacts, content, contacts.tags);
	}
}
