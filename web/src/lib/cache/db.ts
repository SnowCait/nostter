import Dexie, { type EntityTable } from 'dexie';
import type { Event } from 'nostr-typedef';

export type CacheDB = Dexie & {
	events: EntityTable<Event, 'id'>;
};

const db = new Dexie('cache') as CacheDB;

// Notice: Native version is x10. https://dexie.org/docs/Dexie/Dexie.verno
db.version(1).stores({
	events: 'id, kind, pubkey, [kind+pubkey]'
});

export { db };

export class EventCache {
	constructor(private readonly db: CacheDB) {}

	async addIfNotExists(event: Event): Promise<void> {
		await this.db.transaction('rw', [this.db.events], async () => {
			const cachedEvent = await this.db.events.get(event.id);
			if (cachedEvent === undefined) {
				await this.db.events.add(event);
			}
		});
	}

	async getReplaceableEvents(kind: number, pubkey: string): Promise<Event[]> {
		return this.db.events.where({ kind, pubkey }).reverse().sortBy('created_at');
	}
}
