import type { Event } from 'nostr-tools';
import { isAddressableKind } from 'nostr-tools/kinds';
import type { AddressPointer } from 'nostr-tools/nip19';
import { isValidPubkey } from './pubkey';

export function getEventAddress(event: Event): string {
	const identifier = isAddressableKind(event.kind)
		? (event.tags.find(([name]) => name === 'd')?.[1] ?? '')
		: '';

	return `${event.kind}:${event.pubkey}:${identifier}`;
}

export function parseEventAddress(value: string): AddressPointer | undefined {
	const [kind, pubkey, ...identifier] = value.split(':');
	if (!kind || isNaN(Number(kind)) || !isValidPubkey(pubkey)) {
		return undefined;
	}
	return {
		kind: Number(kind),
		pubkey,
		identifier: identifier.join(':')
	};
}
