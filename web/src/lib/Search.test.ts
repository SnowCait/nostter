import { describe, it, expect } from 'vitest';
import { nip19 } from 'nostr-tools';
import { buildSearchQuery, decodeToPubkey, extractDateInputs, parseSearchQuery } from './Search';

const hex = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';
const npub = nip19.npubEncode(hex);
const nprofile = nip19.nprofileEncode({ pubkey: hex, relays: ['wss://relay.example'] });

describe('decodeToPubkey', () => {
	it('decodes npub', () => {
		expect(decodeToPubkey(npub)).toBe(hex);
	});
	it('decodes nprofile to its pubkey', () => {
		expect(decodeToPubkey(nprofile)).toBe(hex);
	});
	it('returns undefined for invalid input', () => {
		expect(decodeToPubkey('not-a-key')).toBeUndefined();
	});
});

describe('parseSearchQuery', () => {
	it('parses npub in from/to', () => {
		const { fromPubkeys, toPubkeys } = parseSearchQuery(`from:${npub} to:${npub}`);
		expect(fromPubkeys).toStrictEqual([hex]);
		expect(toPubkeys).toStrictEqual([hex]);
	});
	it('parses nprofile in from', () => {
		const { fromPubkeys } = parseSearchQuery(`from:${nprofile}`);
		expect(fromPubkeys).toStrictEqual([hex]);
	});
	it('extracts kinds, hashtags and keyword', () => {
		const { kinds, hashtags, keyword } = parseSearchQuery('kind:1 kind:6 #nostr hello world');
		expect(kinds).toStrictEqual([1, 6]);
		expect(hashtags).toStrictEqual(['nostr']);
		expect(keyword).toBe('hello world');
	});
});

describe('extractDateInputs', () => {
	it('extracts raw since/until date strings', () => {
		expect(extractDateInputs('since:2025-01-01 until:2025-06-06')).toStrictEqual({
			sinceDate: '2025-01-01',
			untilDate: '2025-06-06'
		});
	});
	it('returns undefined when absent', () => {
		expect(extractDateInputs('hello')).toStrictEqual({
			sinceDate: undefined,
			untilDate: undefined
		});
	});
});

describe('buildSearchQuery', () => {
	it('builds tokens from structured parts', () => {
		const q = buildSearchQuery({
			kinds: [1, 6],
			fromPubkeys: [hex],
			toPubkeys: [hex],
			sinceDate: '2025-01-01',
			untilDate: '2025-06-06',
			keyword: '#nostr hello'
		});
		expect(q).toBe(
			`from:${npub} to:${npub} kind:1 kind:6 since:2025-01-01 until:2025-06-06 #nostr hello`
		);
	});

	it('round-trips dates and pubkeys through parseSearchQuery', () => {
		const original = `from:${npub} kind:1 since:2025-01-01 until:2025-06-06 #nostr bitcoin`;
		const { fromPubkeys, kinds, hashtags, keyword } = parseSearchQuery(original);
		const { sinceDate, untilDate } = extractDateInputs(original);
		const rebuilt = buildSearchQuery({
			fromPubkeys,
			kinds,
			sinceDate,
			untilDate,
			keyword: [keyword, ...hashtags.map((h) => `#${h}`)].join(' ').trim()
		});
		// Parsing the rebuilt query yields the same structured values.
		const reparsed = parseSearchQuery(rebuilt);
		expect(reparsed.fromPubkeys).toStrictEqual(fromPubkeys);
		expect(reparsed.kinds).toStrictEqual(kinds);
		expect(reparsed.hashtags).toStrictEqual(hashtags);
		expect(reparsed.keyword).toBe(keyword);
		expect(extractDateInputs(rebuilt)).toStrictEqual({
			sinceDate: '2025-01-01',
			untilDate: '2025-06-06'
		});
	});

	it('normalizes nprofile input to npub on rebuild', () => {
		const { fromPubkeys } = parseSearchQuery(`from:${nprofile}`);
		expect(buildSearchQuery({ fromPubkeys })).toBe(`from:${npub}`);
	});

	it('skips invalid kinds', () => {
		expect(buildSearchQuery({ kinds: [1, NaN, -1] })).toBe('kind:1');
	});
});
