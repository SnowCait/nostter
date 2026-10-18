import { NIP05_REGEX } from 'nostr-tools/nip05';

export interface Nip05Identifier {
	localPart: string;
	domain: string;
}

export function parseNip05Identifier(value: string): Nip05Identifier | undefined {
	const match = value.match(NIP05_REGEX);
	if (!match) {
		return undefined;
	}
	const [, localPart = '_', domain] = match;
	return { localPart, domain };
}

export function buildNip05QueryUrl(identifier: Nip05Identifier): string {
	const url = new URL(`https://${identifier.domain}/.well-known/nostr.json`);
	url.searchParams.set('name', identifier.localPart);
	return url.href;
}
