import type { Event } from 'nostr-tools';
import type { id } from './Types';
import { shortcodeRegexp } from './Constants';

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

export function findLastId(tags: string[][]): id | undefined {
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

export const filterEmojiTags = (tags: string[][]): string[][] => {
	return tags.filter(([tagName, shortcode, imageUrl]) => {
		if (tagName !== 'emoji') {
			return false;
		}
		if (shortcode === undefined || imageUrl === undefined) {
			return false;
		}
		if (!shortcodeRegexp.test(shortcode)) {
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

export function getTagContent(tagName: string, tags: string[][]): string {
	const tagContent = tags.find(([n]) => n === tagName)?.at(1);
	return tagContent ?? (tagName === 'd' ? '' : getTagContent('d', tags));
}

export function isNostrHex(hex: string): boolean {
	return /[0-9a-f]{64}/.test(hex);
}

export function getTitle(tags: string[][]): string | undefined {
	return filterTags('title', tags).at(0);
}

export const isLegacyEncryption = (content: string): boolean => content.includes('?iv=');
