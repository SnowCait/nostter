import { kinds as Kind } from 'nostr-tools';
import { Api } from './Api';
import { filterTags } from './EventHelper';
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

export function computeFollowees(
	tags: string[][],
	self: string
): { followees: string[]; originalFollowees: string[] } {
	const pubkeys = new Set(filterTags('p', tags).filter((pubkey) => /[0-9a-z]{64}/.test(pubkey)));
	const originalFollowees = [...pubkeys];
	pubkeys.add(self);
	return { followees: [...pubkeys], originalFollowees };
}

export function updateFolloweesStore(tags: string[][]): void {
	const { followees, originalFollowees } = computeFollowees(tags, auth.pubkey);
	auth.updateFollowees(followees, originalFollowees);
	console.log('[contacts]', followees.length);
	pruneFolloweeReplaceableEventsCache(followees);
}
