import { normalizeRelayUrl } from '$lib/nostr/relay-url';
export interface RelayEntry {
	url: string;
	read: boolean;
	write: boolean;
}

export function parseRelayList(tags: string[][]): RelayEntry[] {
	return tags.flatMap((tag): RelayEntry[] => {
		const [name, value, marker] = tag;
		const url = normalizeRelayUrl(value);
		if (name !== 'r' || url === undefined) return [];

		if (marker === undefined) return [{ url, read: true, write: true }];
		if (marker === 'read') return [{ url, read: true, write: false }];
		if (marker === 'write') return [{ url, read: false, write: true }];

		return [];
	});
}

export function getReadRelays(entries: RelayEntry[]): string[] {
	return entries.filter((e) => e.read).map((e) => e.url);
}

export function getWriteRelays(entries: RelayEntry[]): string[] {
	return entries.filter((e) => e.write).map((e) => e.url);
}
