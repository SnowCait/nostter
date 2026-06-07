import { nip19, type Filter } from 'nostr-tools';
import { get } from 'svelte/store';
import { authorActionReqEmit } from './author/Action';
import { hashtagsRegexp, reverseChronological, searchRelays } from './Constants';
import { EventItem } from './Items';
import { pubkey, readRelays } from './stores/Author';
import { referencesReqEmit } from './timelines/MainTimeline';
import { fetchEvents } from './RxNostrHelper';

export const searchScopes = ['all', 'nostr', 'following', 'mine'] as const;
export type SearchScope = (typeof searchScopes)[number];

const fromRegexp = /from:(nostr:)?((?:npub1|nprofile1)[a-z0-9]{6,})/g;
const toRegexp = /to:(nostr:)?((?:npub1|nprofile1)[a-z0-9]{6,})/g;
const kindRegexp = /kind:(\d+)/g;
const sinceRegexp = /since:([0-9-]+)/;
const untilRegexp = /until:([0-9-]+)/;

/**
 * Decode an npub or nprofile bech32 string to a hex pubkey.
 * Returns undefined for invalid input or other entity types.
 */
export function decodeToPubkey(bech32: string): string | undefined {
	try {
		const decoded = nip19.decode(bech32);
		if (decoded.type === 'npub') {
			return decoded.data;
		}
		if (decoded.type === 'nprofile') {
			return decoded.data.pubkey;
		}
	} catch {
		// ignore invalid bech32
	}
	return undefined;
}

export interface SearchQueryParts {
	fromPubkeys?: string[];
	toPubkeys?: string[];
	kinds?: number[];
	keyword?: string;
	sinceDate?: string;
	untilDate?: string;
}

/**
 * Build a search query string from structured parts.
 * Inverse of parseSearchQuery: pubkeys are encoded to npub, dates are kept as
 * `YYYY-MM-DD` strings, and the free keyword (which may contain inline
 * `#hashtag`) is appended at the end.
 */
export function buildSearchQuery(parts: SearchQueryParts): string {
	const tokens: string[] = [];

	for (const hex of parts.fromPubkeys ?? []) {
		try {
			tokens.push(`from:${nip19.npubEncode(hex)}`);
		} catch {
			// skip invalid hex
		}
	}
	for (const hex of parts.toPubkeys ?? []) {
		try {
			tokens.push(`to:${nip19.npubEncode(hex)}`);
		} catch {
			// skip invalid hex
		}
	}
	for (const kind of parts.kinds ?? []) {
		if (Number.isInteger(kind) && kind >= 0) {
			tokens.push(`kind:${kind}`);
		}
	}
	if (parts.sinceDate) {
		tokens.push(`since:${parts.sinceDate}`);
	}
	if (parts.untilDate) {
		tokens.push(`until:${parts.untilDate}`);
	}
	const keyword = (parts.keyword ?? '').trim();
	if (keyword.length > 0) {
		tokens.push(keyword);
	}

	return tokens.join(' ');
}

/**
 * Extract the raw `since:`/`until:` date strings (`YYYY-MM-DD`) from a query,
 * for round-tripping into `<input type="date">` without timestamp conversion.
 */
export function extractDateInputs(query: string): {
	sinceDate: string | undefined;
	untilDate: string | undefined;
} {
	return {
		sinceDate: query.match(sinceRegexp)?.[1],
		untilDate: query.match(untilRegexp)?.[1]
	};
}

export function parseSearchQuery(
	query: string,
	mine = false
): {
	fromPubkeys: string[];
	toPubkeys: string[];
	hashtags: string[];
	kinds: number[];
	keyword: string;
	since: number | undefined;
	until: number | undefined;
} {
	const fromMatches = query.matchAll(fromRegexp);
	const toMatches = query.matchAll(toRegexp);
	const hashtagsMatches = query.matchAll(hashtagsRegexp);
	const kindMatches = query.matchAll(kindRegexp);
	const sinceMatch = query.match(sinceRegexp);
	const untilMatch = query.match(untilRegexp);

	const fromPubkeys = [...fromMatches]
		.map((match) => decodeToPubkey(match[2]))
		.filter((pubkey): pubkey is string => pubkey !== undefined);
	const toPubkeys = [...toMatches]
		.map((match) => decodeToPubkey(match[2]))
		.filter((pubkey): pubkey is string => pubkey !== undefined);
	const hashtags = [...hashtagsMatches]
		.map((match) => match.groups?.hashtag)
		.filter((t): t is string => t !== undefined);
	hashtags.sort((x, y) => y.length - x.length);
	const kinds = [...kindMatches].map((match) => Number(match[1]));
	let since: number | undefined = undefined;
	if (sinceMatch !== null) {
		const date = new Date(sinceMatch[1]);
		if (!Number.isNaN(date.getTime())) {
			since = Math.floor(date.getTime() / 1000) + date.getTimezoneOffset() * 60;
		}
	}
	let until: number | undefined = undefined;
	if (untilMatch !== null) {
		const date = new Date(untilMatch[1]);
		if (!Number.isNaN(date.getTime())) {
			// Use the next day's 0:00 so the specified day is fully included.
			until =
				Math.floor(date.getTime() / 1000) + date.getTimezoneOffset() * 60 + 24 * 60 * 60;
		}
	}
	console.debug('[search matches]', fromPubkeys, toPubkeys, hashtags, kinds, since, until);

	const $pubkey = get(pubkey);
	if (mine && !fromPubkeys.includes($pubkey)) {
		fromPubkeys.push($pubkey);
	}

	const keyword = query
		.replaceAll(fromRegexp, '')
		.replaceAll(toRegexp, '')
		.replaceAll(kindRegexp, '')
		.replaceAll(hashtagsRegexp, '')
		.replace(sinceRegexp, '')
		.replace(untilRegexp, '')
		.trim();

	return {
		fromPubkeys,
		toPubkeys,
		hashtags,
		kinds,
		keyword,
		since,
		until
	};
}

export class Search {
	async fetch(filter: Filter): Promise<EventItem[]> {
		console.debug(
			'[search filter]',
			filter,
			new Date((filter.until ?? 0) * 1000),
			new Date((filter.since ?? 0) * 1000)
		);
		const events = await fetchEvents(
			[filter],
			filter.search !== undefined ? searchRelays : get(readRelays)
		);
		console.debug('[search events]', events);
		for (const event of events) {
			referencesReqEmit(event);
			authorActionReqEmit(event);
		}
		events.sort(reverseChronological);
		return events.map((event) => new EventItem(event));
	}
}
