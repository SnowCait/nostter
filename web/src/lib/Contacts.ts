import { Kind, type SimplePool } from 'nostr-tools';
import { Api } from './Api';

export class Contacts {
	private readonly api: Api;

	constructor(private readonly authorPubkey: string, pool: SimplePool, writeRelays: string[]) {
		this.api = new Api(pool, writeRelays);
	}

	public async follow(pubkey: string): Promise<void> {
		const contacts = await this.api.fetchContactListEvent(this.authorPubkey);
		console.log('[contacts]', contacts);

		// TODO: Support undefined case
		if (contacts === undefined) {
			console.error('Contacts not found');
			return;
		}

		const pubkeys = new Set(
			contacts.tags.filter(([tagName]) => tagName === 'p').map(([, pubkey]) => pubkey)
		);
		pubkeys.add(pubkey);

		await this.api.signAndPublish(
			Kind.Contacts,
			contacts.content,
			Array.from(pubkeys).map((pubkey) => ['p', pubkey])
		);
	}

	public async unfollow(pubkey: string): Promise<void> {
		const contacts = await this.api.fetchContactListEvent(this.authorPubkey);
		console.log('[contacts]', contacts);
		if (contacts === undefined) {
			console.error('Contacts not found');
			return;
		}

		const pubkeys = new Set(
			contacts.tags.filter(([tagName]) => tagName === 'p').map(([, pubkey]) => pubkey)
		);
		pubkeys.delete(pubkey);

		await this.api.signAndPublish(
			Kind.Contacts,
			contacts.content,
			Array.from(pubkeys).map((pubkey) => ['p', pubkey])
		);
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
