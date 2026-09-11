export interface RelayEntry {
	url: string;
	read: boolean;
	write: boolean;
}

function isRelayUrl(value: string): boolean {
	try {
		const { protocol } = new URL(value);
		return protocol === 'wss:' || protocol === 'ws:';
	} catch {
		return false;
	}
}

export function parseRelayList(tags: string[][]): RelayEntry[] {
	return tags.flatMap((tag): RelayEntry[] => {
		const [name, url, marker] = tag;
		if (name !== 'r' || !isRelayUrl(url)) return [];

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
