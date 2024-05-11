import { Nevent } from '$lib/nip19/Nevent';
import { nip19 } from 'nostr-tools';
import type { LayoutServerLoad } from './$types';
import { defaultRelays } from '$lib/Constants';
import type { Event } from 'nostr-typedef';

export const load: LayoutServerLoad<{ event: Event }> = async ({ params }) => {
	const pointer = Nevent.decode(params.slug);
	const nevent = nip19.neventEncode({
		id: pointer.id,
		relays:
			pointer.relays !== undefined && pointer.relays.length > 0
				? pointer.relays
				: defaultRelays.map(({ url }) => url)
	});
	const response = await fetch(`https://api.nostter.app/${nevent}`);
	const event = await response.json();
	console.log('[thread event]', event);
	return { event };
};
