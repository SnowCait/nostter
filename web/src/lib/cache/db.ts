import Dexie, { type EntityTable, type Table } from 'dexie';
import type * as Nostr from 'nostr-typedef';
import { isAddressableKind, isReplaceableKind } from 'nostr-tools/kinds';
import { getEventIdentifier } from '$lib/nostr/protocol/event-address';

export type AccountAddressableEventCacheEntry = {
	pubkey: string;
	kind: number;
	identifier: string;
	event: Nostr.Event;
};

export type CacheDB = Dexie & {
	events: EntityTable<Nostr.Event, 'id'>;
	followeeReplaceableEvents: Table<Nostr.Event, [number, string]>;
	accountAddressableEvents: Table<AccountAddressableEventCacheEntry, [string, number, string]>;
};

const db = new Dexie('cache') as CacheDB;

// Notice: Native version is x10. https://dexie.org/docs/Dexie/Dexie.verno
db.version(1).stores({
	events: 'id, kind, pubkey, [kind+pubkey]'
});

db.version(2).stores({
	followeeReplaceableEvents: '[kind+pubkey], pubkey'
});

db.version(3).stores({
	accountAddressableEvents: '[pubkey+kind+identifier]'
});

export { db };

export class AccountAddressableEventCache {
	constructor(private readonly db: CacheDB) {}

	async get(pubkey: string, kind: number, identifier = ''): Promise<Nostr.Event | undefined> {
		return (await this.db.accountAddressableEvents.get([pubkey, kind, identifier]))?.event;
	}

	async put(event: Nostr.Event): Promise<boolean> {
		if (!isReplaceableKind(event.kind) && !isAddressableKind(event.kind)) {
			throw new Error('Event has no replaceable address');
		}
		const identifier = getEventIdentifier(event);
		const key: [string, number, string] = [event.pubkey, event.kind, identifier];
		return this.db.transaction('rw', this.db.accountAddressableEvents, async () => {
			const current = await this.db.accountAddressableEvents.get(key);
			if (current !== undefined && current.event.created_at >= event.created_at) {
				return false;
			}
			await this.db.accountAddressableEvents.put({
				pubkey: event.pubkey,
				kind: event.kind,
				identifier,
				event
			});
			return true;
		});
	}

	async remove(pubkey: string, kind: number, identifier = ''): Promise<void> {
		await this.db.accountAddressableEvents.delete([pubkey, kind, identifier]);
	}

	async clear(): Promise<void> {
		await this.db.accountAddressableEvents.clear();
	}
}

export class EventCache {
	constructor(private readonly db: CacheDB) {}

	async addIfNotExists(event: Nostr.Event): Promise<void> {
		await this.db.transaction('rw', [this.db.events], async () => {
			const cachedEvent = await this.db.events.get(event.id);
			if (cachedEvent === undefined) {
				await this.db.events.add(event);
			}
		});
	}

	async getReplaceableEvents(kind: number, pubkey: string): Promise<Nostr.Event[]> {
		return this.db.events.where({ kind, pubkey }).reverse().sortBy('created_at');
	}
}

export class FolloweeReplaceableEventCache {
	constructor(private readonly db: CacheDB) {}

	async put(event: Nostr.Event): Promise<void> {
		await this.db.transaction('rw', [this.db.followeeReplaceableEvents], async () => {
			const current = await this.db.followeeReplaceableEvents.get([event.kind, event.pubkey]);
			if (current === undefined || current.created_at < event.created_at) {
				await this.db.followeeReplaceableEvents.put(event);
			}
		});
	}

	async getLatest(kind: number, pubkeys: string[]): Promise<Map<string, Nostr.Event>> {
		const events = await this.db.followeeReplaceableEvents.bulkGet(
			pubkeys.map((pubkey): [number, string] => [kind, pubkey])
		);
		const eventsMap = new Map<string, Nostr.Event>();
		for (const event of events) {
			if (event !== undefined) {
				eventsMap.set(event.pubkey, event);
			}
		}
		return eventsMap;
	}

	async pruneExcept(pubkeys: string[]): Promise<void> {
		await this.db.followeeReplaceableEvents.where('pubkey').noneOf(pubkeys).delete();
	}
}
