import type { Event, Filter } from 'nostr-tools';
import { Handlerinformation } from 'nostr-tools/kinds';
import type { AddressPointer } from 'nostr-tools/nip19';
import { isHttpUrl } from '$lib/url';
import { parseEventAddress } from './event-address';
import { isSecureRelayUrl } from './relay-url';

export interface ClientTag {
	name: string;
	handler?: {
		address: string;
		pointer: AddressPointer;
		relay?: string;
	};
}

export function parseClientTags(tags: string[][]): ClientTag[] {
	return tags
		.filter(
			([name, clientName]) =>
				name === 'client' && typeof clientName === 'string' && clientName !== ''
		)
		.map(([, name, address, relay]) => {
			// Requiring the exact kind prefix keeps the address identical to getEventAddress() of the handler.
			const pointer =
				typeof address === 'string' && address.startsWith(`${Handlerinformation}:`)
					? parseEventAddress(address)
					: undefined;
			if (pointer === undefined) {
				return { name };
			}
			return {
				name,
				handler: { address, pointer, relay: isSecureRelayUrl(relay) ? relay : undefined }
			};
		});
}

export function createHandlerInformationFilter(
	{ pubkey, identifier }: AddressPointer,
	kind: number
): Filter {
	return {
		kinds: [Handlerinformation],
		authors: [pubkey],
		'#d': [identifier],
		'#k': [String(kind)],
		limit: 1
	};
}

export function resolveHandlerLink(
	handler: Event,
	target: { kind: number; nevent: string }
): URL | undefined {
	if (!handler.tags.some(([name, kind]) => name === 'k' && kind === String(target.kind))) {
		return undefined;
	}

	const webTags = handler.tags.filter(
		([name, template]) => name === 'web' && typeof template === 'string'
	);
	const templates = [
		...webTags.filter(([, , entity]) => entity === 'nevent'),
		...webTags.filter(([, , entity]) => entity === undefined || entity === '')
	].map(([, template]) => template);
	for (const template of templates) {
		const url = applyHandlerUrlTemplate(template, target.nevent);
		if (url !== undefined) {
			return url;
		}
	}
	return parseHandlerWebsite(handler.content);
}

function applyHandlerUrlTemplate(template: string, entity: string): URL | undefined {
	if (!template.includes('<bech32>')) {
		return undefined;
	}
	return parseHttpUrl(template.replaceAll('<bech32>', entity));
}

function parseHandlerWebsite(content: string): URL | undefined {
	let metadata: unknown;
	try {
		metadata = JSON.parse(content);
	} catch {
		return undefined;
	}
	if (typeof metadata !== 'object' || metadata === null || !('website' in metadata)) {
		return undefined;
	}
	return typeof metadata.website === 'string' ? parseHttpUrl(metadata.website) : undefined;
}

function parseHttpUrl(value: string): URL | undefined {
	const url = URL.parse(value);
	return url !== null && isHttpUrl(url) ? url : undefined;
}
