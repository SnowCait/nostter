import { nip19, type Filter, Kind } from 'nostr-tools';
import { get } from 'svelte/store';
import { authorActionReqEmit } from './author/Action';
import { hashtagsRegexp, reverseChronological, searchRelays } from './Constants';
import { EventItem } from './Items';
import { pool } from '../stores/Pool';
import { Api } from './Api';
import { pubkey, readRelays } from '../stores/Author';
import { referencesReqEmit } from './timelines/MainTimeline';

export class Search {
	parseQuery(
		query: string,
		mine = false
	): {
		fromPubkeys: string[];
		toPubkeys: string[];
		hashtags: string[];
		kinds: number[];
		keyword: string;
	} {
		const fromRegexp = /from:(nostr:)?(npub1[a-z0-9]{6,})/g;
		const toRegexp = /to:(nostr:)?(npub1[a-z0-9]{6,})/g;
		const kindRegexp = /kind:(\d+)/g;
		const fromMatches = query.matchAll(fromRegexp);
		const toMatches = query.matchAll(toRegexp);
		const hashtagsMatches = query.matchAll(hashtagsRegexp);
		const kindMatches = query.matchAll(kindRegexp);

		const fromPubkeys = [...fromMatches]
			.map((match) => match[2])
			.map((npub) => nip19.decode(npub).data as string);
		const toPubkeys = [...toMatches]
			.map((match) => match[2])
			.map((npub) => nip19.decode(npub).data as string);
		const hashtags = [...hashtagsMatches]
			.map((match) => match.groups?.hashtag)
			.filter((t): t is string => t !== undefined);
		hashtags.sort((x, y) => y.length - x.length);
		const kinds = [...kindMatches].map((match) => Number(match[1]));
		console.log('[matches]', fromPubkeys, toPubkeys, hashtags, kinds);

		if (kinds.length === 0) {
			kinds.push(Kind.Text);
		}

		const $pubkey = get(pubkey);
		if (mine && !fromPubkeys.includes($pubkey)) {
			fromPubkeys.push($pubkey);
		}

		const keyword = query
			.replaceAll(fromRegexp, '')
			.replaceAll(toRegexp, '')
			.replaceAll(kindRegexp, '')
			.replaceAll(hashtagsRegexp, '')
			.trim();

		return {
			fromPubkeys,
			toPubkeys,
			hashtags,
			kinds,
			keyword
		};
	}

	async fetch(filter: Filter): Promise<EventItem[]> {
		console.log(
			'[search filter]',
			filter,
			new Date((filter.until ?? 0) * 1000),
			new Date((filter.since ?? 0) * 1000)
		);
		const $pool = get(pool);
		const api = new Api($pool, filter.search !== undefined ? searchRelays : get(readRelays));
		const events = await api.fetchEvents([filter]);
		console.log('[search events]', events);
		for (const event of events) {
			referencesReqEmit(event);
			authorActionReqEmit(event);
		}
		events.sort(reverseChronological);
		return events.map((event) => new EventItem(event));
	}
}
