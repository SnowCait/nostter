import Dexie, { type EntityTable, type Table } from 'dexie';
import type * as Nostr from 'nostr-typedef';

export type CacheDB = Dexie & {
	events: EntityTable<Nostr.Event, 'id'>;
	followeeReplaceableEvents: Table<Nostr.Event, [number, string]>;
};

const db = new Dexie('cache') as CacheDB;

// Notice: Native version is x10. https://dexie.org/docs/Dexie/Dexie.verno
db.version(1).stores({
	events: 'id, kind, pubkey, [kind+pubkey]'
});

db.version(2).stores({
	followeeReplaceableEvents: '[kind+pubkey], pubkey'
});

export { db };

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
