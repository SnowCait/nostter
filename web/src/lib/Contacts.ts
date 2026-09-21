import { kinds as Kind } from 'nostr-tools';
import { Api } from './Api';
import { auth } from './auth.svelte';
import { parseFollowList } from './nostr/protocol/nip02';
import type { Signer } from './nostr/signing/signer';
import { sendEvent } from './RxNostrHelper';
import { pruneFolloweeReplaceableEventsCache } from './cache/Events';

export class Contacts {
	private readonly api: Api;

	constructor(private readonly authorPubkey: string) {
		this.api = new Api();
	}

	// For legacy clients
	public async updateRelays(
		relays: Map<string, { read: boolean; write: boolean }>,
		signEvent: Signer['signEvent']
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

		await sendEvent(signEvent, Kind.Contacts, content, contacts.tags);
	}
}

export function updateFolloweesStore(tags: string[][]): void {
	const followingPubkeys = parseFollowList(tags).map(({ pubkey }) => pubkey);
	auth.updateFollowingPubkeys(followingPubkeys);
	pruneFolloweeReplaceableEventsCache(auth.followees);
}
