export function filterTags(tagName: string, tags: string[][]) {
	return tags
		.filter(([name, content]) => name === tagName && content !== undefined && content !== '')
		.map(([, content]) => content);
}

export function filterRelayTags(tags: string[][]): string[][] {
	return tags.filter(([tagName, relay]) => {
		if (tagName !== 'r') {
			return false;
		}

		try {
			const url = new URL(relay);
			return url.protocol === 'wss:' || url.protocol === 'ws:';
		} catch {
			return false;
		}
	});
}

export function relayTagsToMap(tags: string[][]): Map<string, { read: boolean; write: boolean }> {
	return new Map(
		filterRelayTags(tags).map(([, relay, permission]) => [
			relay,
			{
				read: permission === undefined || permission === 'read',
				write: permission === undefined || permission === 'write'
			}
		])
	);
}

export function parseRelayJson(content: string): Map<string, { read: boolean; write: boolean }> {
	const relays = new Map<string, { read: boolean; write: boolean }>(
		Object.entries(JSON.parse(content))
	);
	return new Map(
		[...relays].filter(([relay]) => {
			try {
				const url = new URL(relay);
				return url.protocol === 'wss:' || url.protocol === 'ws:';
			} catch {
				return false;
			}
		})
	);
}
