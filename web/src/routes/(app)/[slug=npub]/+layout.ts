import { error } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';
import { User } from '$lib/User';

export const load: LayoutLoad<{
	pubkey: string;
	relays: string[];
}> = async ({ params }) => {
	console.log('[npub page load]', params.slug);
	const data = await User.decode(params.slug);
	if (data.pubkey === undefined) {
		throw error(404, 'Not Found');
	}
	return {
		pubkey: data.pubkey,
		relays: data.relays
	};
};
