import type { Event } from 'nostr-tools';

export function isReply(event: Event): boolean {
	if (!event.tags.some(([tagName]) => tagName === 'p')) {
		return false;
	}

	if (
		event.kind === 42 &&
		!event.tags.some(([tagName, , , marker]) => tagName === 'e' && marker !== 'root')
	) {
		return false;
	}

	return event.tags.some(
		([tagName, , , marker]) =>
			tagName === 'e' && (marker === 'reply' || marker === 'root' || marker === undefined)
	);
}

export function findIdentifier(tags: string[][]): string | undefined {
	const tag = tags.find(([name]) => name === 'd');
	if (tag === undefined) {
		return undefined;
	}
	return tag.at(1) ?? '';
}

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

export function referTags(event: Event): {
	root: string[] | undefined;
	reply: string[] | undefined;
} {
	let root = event.tags.findLast(([tagName, , , marker]) => tagName === 'e' && marker === 'root');
	let reply = event.tags.findLast(
		([tagName, , , marker]) => tagName === 'e' && marker === 'reply'
	);
	console.log(root, reply);

	// Deprecated NIP-10
	if (root === undefined && reply === undefined) {
		const eTags = event.tags.filter((tag) => tag.at(0) === 'e' && tag.length < 4);
		if (eTags.length === 1) {
			reply = eTags[0];
		} else if (eTags.length > 1) {
			root = eTags[0];
			reply = eTags[eTags.length - 1];
		}
	}

	return { root, reply };
}
