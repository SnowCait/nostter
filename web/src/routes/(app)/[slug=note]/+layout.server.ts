import type { Event } from 'nostr-typedef';
import { nip19 } from 'nostr-tools';
import type { LayoutServerLoad } from './$types';
import { defaultRelays } from '$lib/Constants';

export const load: LayoutServerLoad<{ event: Event | undefined }> = async ({ params }) => {
	const slug = params.slug;
	console.log('[nevent server load]', slug);

	let id: string;
	let relays: string[] = defaultRelays.map(({ url }) => url);

	try {
		const { type, data } = nip19.decode(slug);
		switch (type) {
			case 'note': {
				id = data;
				break;
			}
			case 'nevent': {
				id = data.id;
				if (data.relays !== undefined && data.relays.length > 0) {
					relays = data.relays;
				}
				break;
			}
			default: {
				throw new Error('Logic error');
			}
		}
	} catch (error) {
		console.warn('[nevent server load decode error]', error);
		return {
			event: undefined
		};
	}

	console.log('[nevent server load data]', id, relays);

	const response = await fetch(`https://api.nostter.app/${nip19.neventEncode({ id, relays })}`);
	if (!response.ok) {
		console.warn('[nevent server load event not found]', await response.text());
		return {
			event: undefined
		};
	}
	const event = (await response.json()) as Event;
	console.log('[nevent server load event]', event);
	return { event };
};
