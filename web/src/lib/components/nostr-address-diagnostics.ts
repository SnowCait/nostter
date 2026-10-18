import { parseNip05Identifier, buildNip05QueryUrl } from '@nostter/nostr-protocol';
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
				| 'pubkeyMismatch'
				| 'networkError'
				| 'redirect';
	  }
	| { status: 'httpError'; code: number };

export function getNostrAddressQuery(address: string): NostrAddressQuery | undefined {
	const identifier = parseNip05Identifier(address);
	if (!identifier) {
		return undefined;
	}
	try {
		return { url: buildNip05QueryUrl(identifier), name: identifier.localPart };
	} catch {
		return undefined;
	}
}

export async function diagnoseNostrAddress(
	query: NostrAddressQuery,
	profilePubkey: string,
	signal: AbortSignal
): Promise<NostrAddressDiagnosis> {
	try {
		const response = await fetch(query.url, { redirect: 'manual', signal });
		// Cross-origin redirects hide their status and body from browser JavaScript.
		if (response.type === 'opaqueredirect') {
			return { status: 'redirect' };
		}
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
		if (!isValidPubkey(pubkey)) {
			return { status: 'pubkeyError' };
		}
		return { status: pubkey === profilePubkey ? 'success' : 'pubkeyMismatch' };
	} catch {
		return { status: 'networkError' };
	}
}
