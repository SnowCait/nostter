import type { Event } from 'nostr-tools';
import { Zap } from 'nostr-tools/kinds';

export function getZapSenderPubkey(event: Event): string | undefined {
	if (event.kind !== Zap) {
		return undefined;
	}

	const pubkey = event.tags.find(
		([name, value]) => name === 'P' && value !== undefined && value !== ''
	)?.[1];
	if (pubkey !== undefined) {
		return pubkey;
	}

	const description = event.tags.find(
		([name, value]) => name === 'description' && value !== undefined && value !== ''
	)?.[1];
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
