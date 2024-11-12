import { error } from '@sveltejs/kit';
import { get } from 'svelte/store';
import type { Event } from 'nostr-typedef';
import type { LayoutServerLoad } from './$types';
import { metadataStore, storeMetadata } from '$lib/cache/Events';
import { checkRestriction } from '$lib/server/Restriction';
import { fetchMetadata } from '$lib/Api';
import { appName, defaultRelays } from '$lib/Constants';
import { User } from '$lib/User';

type Data = {
	pubkey: string;
	relays: string[];
	metadataEvent: Event | undefined;
	title: string;
	description: string;
	image?: string;
};

export const load: LayoutServerLoad<Data> = async ({ params }) => {
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

	const $metadataStore = get(metadataStore);
	const metadata = $metadataStore.get(pubkey);

	const data: Data = {
		pubkey,
		relays,
		metadataEvent,
		title: `${appName} - ${metadata?.displayName ?? 'ghost'}`,
		description: metadata?.about ?? ''
	};
	if (metadata?.picture) {
		data.image = metadata.picture;
	}
	return data;
};
