import type { Event } from 'nostr-tools';
import { isAddressableKind } from 'nostr-tools/kinds';
import type { AddressPointer } from 'nostr-tools/nip19';
import { isValidPubkey } from './pubkey';

export function findIdentifier(tags: string[][]): string | undefined {
	const tag = tags.find(([name]) => name === 'd');
	if (tag === undefined) {
		return undefined;
	}
	return tag.at(1) ?? '';
}

export function getEventAddress(event: Event): string {
	const identifier = isAddressableKind(event.kind) ? (findIdentifier(event.tags) ?? '') : '';

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
