import { Kind, type SimplePool } from 'nostr-tools';
import { Api } from './Api';
import { WebStorage } from './WebStorage';

export class Contacts {
	private readonly api: Api;

	constructor(private readonly authorPubkey: string, pool: SimplePool, writeRelays: string[]) {
		this.api = new Api(pool, writeRelays);
	}

	public async follow(pubkey: string): Promise<void> {
		const contacts = await this.api.fetchContactsEvent(this.authorPubkey);
		console.log('[contacts]', contacts);

		// Validation
		const storage = new WebStorage(localStorage);
		const cache = storage.getReplaceableEvent(3);
		console.debug('[contacts cache]', cache);
		if (
			contacts !== undefined &&
			cache !== undefined &&
			contacts.created_at < cache.created_at
		) {
			throw new Error('Fetched event is older than cache.');
		}

		if (
			contacts !== undefined &&
			contacts.tags.some(([tagName, p]) => tagName === 'p' && p === pubkey)
		) {
			console.log('[already follow]', pubkey, contacts);
			return;
		}

		const tags = contacts?.tags ?? [];
		tags.push(['p', pubkey]);

		await this.api.signAndPublish(Kind.Contacts, contacts?.content ?? '', tags);
	}

	public async unfollow(pubkey: string): Promise<void> {
		const contacts = await this.api.fetchContactsEvent(this.authorPubkey);
		console.log('[contacts]', contacts);
		if (contacts === undefined) {
			console.error('Contacts not found');
			return;
		}

		await this.api.signAndPublish(
			Kind.Contacts,
			contacts.content,
			contacts.tags.filter(([tagName, p]) => !(tagName === 'p' && p === pubkey))
		);
	}

	// For legacy clients
	public async updateRelays(
		relays: Map<string, { read: boolean; write: boolean }>
	): Promise<void> {
		const contacts = await this.api.fetchContactsEvent(this.authorPubkey);
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
