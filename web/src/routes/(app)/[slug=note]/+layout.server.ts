import { nip19 } from 'nostr-tools';
import type { Event } from 'nostr-typedef';
import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { defaultRelays } from '$lib/Constants';
import { fetchEvent } from '$lib/Api';

export const load: LayoutServerLoad<{
	eventId: string;
	relays: string[];
	event: Event | undefined;
}> = async ({ params }) => {
	console.debug('[thread page load]', params.slug);
	try {
		const { type, data } = nip19.decode(params.slug);
		console.debug('[thread decode]', type, data);

		let id: string;
		let relays: string[] = [];

		switch (type) {
			case 'note': {
				id = data;
				break;
			}
			case 'nevent': {
				id = data.id;
				if (data.relays !== undefined) {
					relays = data.relays;
				}
				break;
			}
			default: {
				error(500);
			}
		}

		const event = await fetchEvent(
			id,
			relays.length > 0 ? relays : defaultRelays.map(({ url }) => url)
		);

		return {
			eventId: id,
			relays,
			event
		};
	} catch (e) {
		console.error('[thread page decode error]', e);
		error(404, 'Not Found');
	}
};
