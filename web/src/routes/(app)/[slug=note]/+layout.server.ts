import { nip19 } from 'nostr-tools';
import { LongFormArticle } from 'nostr-tools/kinds';
import type * as Nostr from 'nostr-typedef';
import { error, redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { defaultRelays } from '$lib/Constants';
import { fetchEvent } from '$lib/Api';
import { findIdentifier } from '$lib/nostr/protocol/event-address';
import { checkRestriction } from '$lib/server/Restriction';

export const load: LayoutServerLoad<{
	eventId: string;
	relays: string[];
	event: Nostr.Event | undefined;
}> = async ({ params, platform }) => {
	let id = '';
	let relays: string[] = [];
	let event: Nostr.Event | undefined;

	try {
		const { type, data } = nip19.decode(params.slug);

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

		event = await fetchEvent(
			id,
			relays.length > 0 ? relays : defaultRelays.map(({ url }) => url)
		);

		if (event !== undefined) {
			await checkRestriction(event.pubkey, platform);
		}
	} catch {
		error(404, 'Not Found');
	}

	if (event?.kind === LongFormArticle) {
		const naddr = nip19.naddrEncode({
			kind: event.kind,
			pubkey: event.pubkey,
			identifier: findIdentifier(event.tags) ?? '',
			relays
		});
		redirect(308, `/${naddr}`);
	}

	return {
		eventId: id,
		relays,
		event
	};
};
