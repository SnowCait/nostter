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

export function filterTags(tagName: string, tags: string[][]) {
	return tags
		.filter(([name, content]) => name === tagName && content !== undefined && content !== '')
		.map(([, content]) => content);
}
