import Dexie, { liveQuery, type EntityTable } from 'dexie';

interface PrivateNickname {
	pubkey: string;
	nickname: string;
}

const db = new Dexie('private-nicknames') as Dexie & {
	nicknames: EntityTable<PrivateNickname, 'pubkey'>;
};
db.version(1).stores({ nicknames: 'pubkey' });

let nicknames = $state.raw<ReadonlyMap<string, string>>(new Map());

export function observePrivateNicknames(): () => void {
	const subscription = liveQuery(() => db.nicknames.toArray()).subscribe({
		next: (rows) => {
			nicknames = new Map(rows.map(({ pubkey, nickname }) => [pubkey, nickname]));
		},
		error: (error) => console.error('Could not load private nicknames', error)
	});
	return () => subscription.unsubscribe();
}

export function getPrivateNickname(pubkey: string): string | undefined {
	return nicknames.get(pubkey);
}

export async function savePrivateNickname(pubkey: string, nickname: string): Promise<void> {
	await db.nicknames.put({ pubkey, nickname: nickname.trim() });
}

export async function deletePrivateNickname(pubkey: string): Promise<void> {
	await db.nicknames.delete(pubkey);
}
