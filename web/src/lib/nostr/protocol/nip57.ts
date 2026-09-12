import type { Event } from 'nostr-tools';
import { Zap } from 'nostr-tools/kinds';
import { filterTags } from '../../EventHelper';

export function getZapSenderPubkey(event: Event): string | undefined {
	if (event.kind !== Zap) {
		return undefined;
	}

	const pubkey = filterTags('P', event.tags).at(0);
	if (pubkey !== undefined) {
		return pubkey;
	}

	const description = filterTags('description', event.tags).at(0);
	if (description === undefined) {
		return undefined;
	}

	try {
		const event9734 = JSON.parse(description) as Event;
		return event9734.pubkey;
	} catch (error) {
		console.warn('[kind 9735 description decode error]', event, error);
		return undefined;
	}
}
