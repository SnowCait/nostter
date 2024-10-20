import { error } from '@sveltejs/kit';
import type { Event } from 'nostr-typedef';
import type { LayoutServerLoad } from './$types';
import { storeMetadata } from '$lib/cache/Events';
import { checkRestriction } from '$lib/server/Restriction';
import { fetchMetadata } from '$lib/Api';
import { defaultRelays } from '$lib/Constants';
import { User } from '$lib/User';

export const load: LayoutServerLoad<{
	pubkey: string;
	relays: string[];
	metadataEvent: Event | undefined;
}> = async ({ params }) => {
	console.log('[npub page load]', params.slug);
	console.time('[npub decode]');
	const { pubkey, relays } = await User.decode(params.slug);
	console.timeEnd('[npub decode]');
	if (pubkey === undefined) {
		error(404, 'Not Found');
	}

	await checkRestriction(pubkey);

	console.time('[metadata]');
	const metadataEvent = await fetchMetadata(
		pubkey,
		relays.length > 0 ? relays : defaultRelays.filter(({ read }) => read).map(({ url }) => url)
	);
	console.timeEnd('[metadata]');

	if (metadataEvent !== undefined) {
		storeMetadata(metadataEvent);
	}

	return { pubkey, relays, metadataEvent };
};
