import { nip19 } from 'nostr-tools';
import type { Event } from 'nostr-typedef';
import { error } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad<{
	eventId: string;
	relays: string[];
	event: Event | undefined;
}> = async ({ params, data: serverData }) => {
	console.log('[thread page load]', params.slug);
	try {
		const { type, data } = nip19.decode(params.slug);
		console.log('[decode]', type, data);

		switch (type) {
			case 'note': {
				return {
					eventId: data as string,
					relays: [],
					event: serverData.event
				};
			}
			case 'nevent': {
				const pointer = data as nip19.EventPointer;
				const relays = pointer.relays ?? [];

				return {
					eventId: pointer.id,
					relays,
					event: serverData.event
				};
			}
			default: {
				error(500);
			}
		}
	} catch (e) {
		console.error('[thread page decode error]', e);
		error(404, 'Not Found');
	}
};
