import { nip19, type Event } from 'nostr-tools';
import type { id } from './Types';
import { isParameterizedReplaceableKind, isReplaceableKind } from './nostr-tools/kinds';

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

export function findChannelId(tags: string[][]): string | undefined {
	return tags
		.find(
			([tagName, , , marker]) =>
				(tagName === 'e' && marker === 'root') || marker === undefined
		)
		?.at(1);
}

export function findReactionToId(tags: string[][]): id | undefined {
	const ids = filterTags('e', tags);
	if (ids.length === 0) {
		return undefined;
	}
	return ids[ids.length - 1];
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

export const filterEmojiTags = (tags: string[][]): string[][] => {
	return tags.filter(([tagName, shortcode, imageUrl]) => {
		if (tagName !== 'emoji') {
			return false;
		}
		if (shortcode === undefined || imageUrl === undefined) {
			return false;
		}
		if (!/^\w+$/.test(shortcode)) {
			return false;
		}
		try {
			new URL(imageUrl);
			return true;
		} catch {
			return false;
		}
	});
};

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
	try {
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
	} catch (error) {
		console.error('[kind 3 content parse error]', error);
		return new Map();
	}
}

export function referTags(event: Event): {
	root: string[] | undefined;
	reply: string[] | undefined;
} {
	let root = event.tags.findLast(([tagName, , , marker]) => tagName === 'e' && marker === 'root');
	let reply = event.tags.findLast(
		([tagName, , , marker]) => tagName === 'e' && marker === 'reply'
	);

	// Deprecated NIP-10
	if (root === undefined || reply === undefined) {
		const eTags = event.tags.filter(
			([tagName, , , marker]) => tagName === 'e' && marker !== 'mention'
		);
		if (eTags.length === 1) {
			root = root ?? eTags[0];
			reply = undefined;
		} else if (eTags.length > 1) {
			root = root ?? eTags[0];
			reply = reply ?? eTags[eTags.length - 1];
		}
	}

	return { root, reply };
}

export function getTagContent(tagName: string, tags: string[][]): string {
	const tagContent = tags.find(([n]) => n === tagName)?.at(1);
	return tagContent ?? (tagName === 'd' ? '' : getTagContent('d', tags));
}

export function aTagContent(event: Event): string {
	return `${event.kind}:${event.pubkey}:${findIdentifier(event.tags) ?? ''}`;
}

export function getZapperPubkey(event: Event): string | undefined {
	if (event.kind !== 9735) {
		return undefined;
	}

	const pubkey = filterTags('P', event.tags).at(0);
	if (pubkey !== undefined) {
		return pubkey;
	}

	const description = filterTags('description', event.tags).at(0);
	if (description === undefined) {
		return undefined;
	}

	try {
		const event9734 = JSON.parse(description) as Event;
		return event9734.pubkey;
	} catch (error) {
		console.warn('[kind 9735 description decode error]', event, error);
		return undefined;
	}
}

export function isNostrHex(hex: string): boolean {
	return /[0-9a-f]{64}/.test(hex);
}

export function getTitle(tags: string[][]): string | undefined {
	return filterTags('title', tags).at(0);
}

export function getAddress(event: Event): string {
	if (isReplaceableKind(event.kind)) {
		return nip19.naddrEncode({
			kind: event.kind,
			pubkey: event.pubkey,
			identifier: ''
		});
	} else if (isParameterizedReplaceableKind(event.kind)) {
		return nip19.naddrEncode({
			kind: event.kind,
			pubkey: event.pubkey,
			identifier: findIdentifier(event.tags) ?? ''
		});
	} else {
		return nip19.neventEncode({ id: event.id, author: event.pubkey });
	}
}
