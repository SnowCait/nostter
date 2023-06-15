import { Kind, type Event } from 'nostr-tools';
import { get } from 'svelte/store';
import { Api } from './Api';
import { pool } from '../stores/Pool';
import {
	followees,
	recommendedRelay,
	readRelays,
	writeRelays,
	updateRelays
} from '../stores/Author';
import { RelaysFetcher } from './RelaysFetcher';
import { filterTags } from './EventHelper';

export class Author {
	constructor(private pubkey: string) {}

	isRelated(event: Event): boolean {
		return (
			event.pubkey !== this.pubkey &&
			event.tags.some(
				([tagName, tagContent]) => tagName === 'p' && tagContent === this.pubkey
			)
		);
	}

	async fetchRelays(relays: string[]) {
		const relayEvents = await RelaysFetcher.fetchEvents(this.pubkey, relays);
		console.log('[relay events]', relayEvents);

		this.saveRelays(relayEvents);
	}

	// TODO: Ensure created_at
	public saveRelays(replaceableEvents: Map<Kind, Event>) {
		const recommendedRelayEvent = replaceableEvents.get(Kind.RecommendRelay);
		if (recommendedRelayEvent !== undefined) {
			recommendedRelay.set(recommendedRelayEvent.content);
			console.log('[recommended relay]', get(recommendedRelay));
		}

		const contactsEvent = replaceableEvents.get(Kind.Contacts);
		if (contactsEvent !== undefined) {
			const pubkeys = new Set(filterTags('p', contactsEvent.tags));
			pubkeys.add(this.pubkey); // Add myself
			followees.set(Array.from(pubkeys));
			console.log('[contacts]', pubkeys);

			if (contactsEvent.content === '') {
				console.log('[relays in kind 3] empty');
			} else {
				const relays = new Map<string, { read: boolean; write: boolean }>(
					Object.entries(JSON.parse(contactsEvent.content))
				);
				const validRelays = [...relays].filter(([relay]) => {
					try {
						const url = new URL(relay);
						return url.protocol === 'wss:' || url.protocol === 'ws:';
					} catch {
						return false;
					}
				});
				console.log(relays, pubkeys);
				readRelays.set(
					Array.from(
						new Set(validRelays.filter(([, { read }]) => read).map(([relay]) => relay))
					)
				);
				writeRelays.set(
					Array.from(
						new Set(
							validRelays.filter(([, { write }]) => write).map(([relay]) => relay)
						)
					)
				);
				console.log('[relays in kind 3]', get(readRelays), get(writeRelays));
			}
		}

		const relayListEvent = replaceableEvents.get(Kind.RelayList);
		if (
			relayListEvent !== undefined &&
			(contactsEvent === undefined ||
				contactsEvent.content === '' ||
				contactsEvent.created_at < relayListEvent.created_at)
		) {
			updateRelays(relayListEvent);
			console.log('[relays in kind 10002]', get(readRelays), get(writeRelays));
		}
	}

	async fetchEvents(): Promise<{
		replaceableEvents: Map<Kind, Event>;
		parameterizedReplaceableEvents: Map<string, Event>;
	}> {
		const api = new Api(get(pool), get(writeRelays));
		return await api.fetchAuthorEvents(this.pubkey);
	}
}
