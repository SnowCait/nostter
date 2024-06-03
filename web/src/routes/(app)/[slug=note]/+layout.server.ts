import { createRxBackwardReq, createRxNostr, uniq } from 'rx-nostr';
import { firstValueFrom } from 'rxjs';
import type { Event } from 'nostr-typedef';
import { nip19 } from 'nostr-tools';
import WebSocket from 'ws';
import type { LayoutServerLoad } from './$types';
import { defaultRelays } from '$lib/Constants';

const rxNostr = createRxNostr({ websocketCtor: WebSocket });

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
			}
			default: {
				throw new Error('Logic error');
			}
		}
	} catch (error) {
		return {
			event: undefined
		};
	}

	console.log('[nevent server load id]', id);

	try {
		const req = createRxBackwardReq();
		const promise = firstValueFrom(rxNostr.use(req).pipe(uniq()));
		req.emit([{ ids: [id] }], { relays });
		req.over();
		const { event } = await promise;
		return { event };
	} catch (e) {
		return {
			event: undefined
		};
	}
};
