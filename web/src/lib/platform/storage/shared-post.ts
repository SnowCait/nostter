import Dexie, { type EntityTable } from 'dexie';

export interface SharedPost {
	id: string;
	title: string | null;
	text: string | null;
	url: string | null;
	files: File[];
}

type SharedPostDB = Dexie & { shares: EntityTable<SharedPost, 'id'> };

const db = new Dexie('shared-posts') as SharedPostDB;
db.version(1).stores({ shares: 'id' });

export async function saveSharedPost(share: Omit<SharedPost, 'id'>): Promise<string> {
	const id = crypto.randomUUID();
	await db.shares.add({ id, ...share });
	return id;
}

export async function consumeSharedPost(id: string): Promise<SharedPost | undefined> {
	return db.transaction('rw', db.shares, async () => {
		const share = await db.shares.get(id);
		if (share !== undefined) await db.shares.delete(id);
		return share;
	});
}
