import { nip19 } from 'nostr-tools';
import type { EventPointer } from 'nostr-tools/lib/nip19';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
	console.log('[thread page load]', params.slug);
	try {
		const { type, data } = nip19.decode(params.slug);
		console.log('[decode]', type, data);

		switch (type) {
			case 'note': {
				return {
					eventId: data as string,
					relays: []
				};
			}
			case 'nevent': {
				const pointer = data as EventPointer;
				return {
					eventId: pointer.id,
					relays: pointer.relays ?? []
				};
			}
			default: {
				throw error(500);
			}
		}
	} catch (e) {
		console.error('[thread page decode error]', e);
		throw error(404, 'Not found');
	}
};
