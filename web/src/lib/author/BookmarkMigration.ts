import { addressRegexp, hexRegexp, legacyBookmarkIdentifier } from '$lib/Constants';
import { findIdentifier } from '$lib/EventHelper';
import { kinds as Kind, type Event } from 'nostr-tools';

type BookmarkEvent = Pick<Event, 'kind' | 'tags'>;

export function isLegacyBookmarkEvent(event: BookmarkEvent): boolean {
	return (
		event.kind === Kind.Genericlists && findIdentifier(event.tags) === legacyBookmarkIdentifier
	);
}

export function filterBookmarkReferences(tags: string[][]): string[][] {
	return tags
		.filter(
			([tagName, reference]) =>
				(tagName === 'e' && hexRegexp.test(reference)) ||
				(tagName === 'a' && addressRegexp.test(reference))
		)
		.map((tag) => [...tag]);
}

export function mergeBookmarkReferences(
	existingReferences: string[][],
	legacyTags: string[][]
): string[][] {
	const merged = existingReferences.map((tag) => [...tag]);
	const references = new Set(
		existingReferences.map(([tagName, reference]) => JSON.stringify([tagName, reference]))
	);

	for (const tag of filterBookmarkReferences(legacyTags)) {
		const reference = JSON.stringify([tag[0], tag[1]]);
		if (!references.has(reference)) {
			merged.push(tag);
			references.add(reference);
		}
	}

	return merged;
}
