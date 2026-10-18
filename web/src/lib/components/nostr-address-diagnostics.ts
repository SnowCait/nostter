import { NIP05_REGEX } from 'nostr-tools/nip05';
import { isValidPubkey } from '$lib/nostr/protocol/pubkey';

export interface NostrAddressQuery {
	url: string;
	name: string;
}

export type NostrAddressDiagnosis =
	| {
			status:
				| 'success'
				| 'jsonError'
				| 'responseError'
				| 'nameNotFound'
				| 'pubkeyError'
				| 'networkError';
	  }
	| { status: 'httpError'; code: number };

export function getNostrAddressQuery(address: string): NostrAddressQuery | undefined {
	const match = address.match(NIP05_REGEX);
	if (!match) {
		return undefined;
	}
	const [, name = '_', domain] = match;
	try {
		return { url: new URL(`https://${domain}/.well-known/nostr.json?name=${name}`).href, name };
	} catch {
		return undefined;
	}
}

export async function diagnoseNostrAddress(
	query: NostrAddressQuery,
	signal: AbortSignal
): Promise<NostrAddressDiagnosis> {
	try {
		const response = await fetch(query.url, { redirect: 'manual', signal });
		// Cross-origin redirects hide their status and body from browser JavaScript.
		if (response.status === 0) {
			return { status: 'networkError' };
		}
		if (response.status !== 200) {
			return { status: 'httpError', code: response.status };
		}

		let json: unknown;
		try {
			json = await response.json();
		} catch (error) {
			return { status: error instanceof SyntaxError ? 'jsonError' : 'networkError' };
		}
		if (
			typeof json !== 'object' ||
			json === null ||
			!('names' in json) ||
			typeof json.names !== 'object' ||
			json.names === null ||
			Array.isArray(json.names)
		) {
			return { status: 'responseError' };
		}
		if (!Object.hasOwn(json.names, query.name)) {
			return { status: 'nameNotFound' };
		}
		const pubkey = (json.names as Record<string, unknown>)[query.name];
		return { status: isValidPubkey(pubkey) ? 'success' : 'pubkeyError' };
	} catch {
		return { status: 'networkError' };
	}
}
