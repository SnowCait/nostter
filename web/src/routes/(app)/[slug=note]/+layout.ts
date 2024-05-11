import { nip19 } from 'nostr-tools';
import type { Event } from 'nostr-typedef';
import { error } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad<{ eventId: string; relays: string[]; event: Event }> = async ({
	params,
	data: serverData
}) => {
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
				return {
					eventId: data.id,
					relays: data.relays ?? [],
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
