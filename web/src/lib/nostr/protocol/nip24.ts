import { isRelayUrl } from './relay-url';

export function parseLegacyRelayList(
	content: string
): Map<string, { read: boolean; write: boolean }> {
	try {
		const relays = new Map<string, { read: boolean; write: boolean }>(
			Object.entries(JSON.parse(content))
		);
		return new Map([...relays].filter(([relay]) => isRelayUrl(relay)));
	} catch (error) {
		console.error('[kind 3 content parse error]', error);
		return new Map();
	}
}
