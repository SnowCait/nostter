import Dexie, { type EntityTable } from 'dexie';

export interface SharedPost {
	id: string;
	createdAt: number;
	title: string | null;
	text: string | null;
	url: string | null;
	files: File[];
}

type SharedPostDB = Dexie & { shares: EntityTable<SharedPost, 'id'> };

const db = new Dexie('shared-posts') as SharedPostDB;
db.version(1).stores({ shares: 'id' });
db.version(2)
	.stores({ shares: 'id, createdAt' })
	.upgrade((transaction) => transaction.table('shares').clear());

const sharedPostTtlMs = 60 * 60 * 1000;

async function deleteExpiredShares(now: number): Promise<void> {
	await db.shares
		.where('createdAt')
		.below(now - sharedPostTtlMs)
		.delete();
}

export async function saveSharedPost(share: Omit<SharedPost, 'id' | 'createdAt'>): Promise<string> {
	const id = crypto.randomUUID();
	const createdAt = Date.now();
	await db.transaction('rw', db.shares, async () => {
		await deleteExpiredShares(createdAt);
		await db.shares.add({ id, createdAt, ...share });
	});
	return id;
}

export async function consumeSharedPost(id: string): Promise<SharedPost | undefined> {
	return db.transaction('rw', db.shares, async () => {
		const share = await db.shares.get(id);
		if (share !== undefined) await db.shares.delete(id);
		return share;
	});
}
