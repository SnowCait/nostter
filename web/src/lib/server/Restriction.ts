import { error } from '@sveltejs/kit';

export async function checkRestriction(
	pubkey: string,
	platform: App.Platform | undefined
): Promise<void> {
	const kv = platform?.env?.RESTRICTION;
	if (kv === undefined) {
		return;
	}

	const restriction = await kv.get<Restriction>(pubkey, 'json');
	if (restriction !== null) {
		console.error('[npub restriction]', restriction);
		error(restriction.status, restriction.statusText);
	}
}

interface Restriction {
	status: number;
	statusText: string;
	reason: string;
}
