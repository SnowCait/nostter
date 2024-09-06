import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { User } from '$lib/User';
import { checkRestriction } from '$lib/server/Restriction';

export const load: LayoutServerLoad<{
	pubkey: string;
	relays: string[];
}> = async ({ params }) => {
	console.log('[npub page load]', params.slug);
	console.time('[npub decode]');
	const { pubkey, relays } = await User.decode(params.slug);
	console.timeEnd('[npub decode]');
	if (pubkey === undefined) {
		error(404, 'Not Found');
	}

	await checkRestriction(pubkey);

	return { pubkey, relays };
};
