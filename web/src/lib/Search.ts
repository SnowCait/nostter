import { nip19, type Filter, Kind } from 'nostr-tools';
import { get } from 'svelte/store';
import { authorActionReqEmit } from './author/Action';
import { hashtagsRegexp, reverseChronological, searchRelays } from './Constants';
import { EventItem } from './Items';
import { pool } from './stores/Pool';
import { Api } from './Api';
import { pubkey, readRelays } from './stores/Author';
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
		since: number | undefined;
		until: number | undefined;
	} {
		const fromRegexp = /from:(nostr:)?(npub1[a-z0-9]{6,})/g;
		const toRegexp = /to:(nostr:)?(npub1[a-z0-9]{6,})/g;
		const kindRegexp = /kind:(\d+)/g;
		const sinceRegexp = /since:([0-9-]+)/;
		const untilRegexp = /until:([0-9-]+)/;
		const fromMatches = query.matchAll(fromRegexp);
		const toMatches = query.matchAll(toRegexp);
		const hashtagsMatches = query.matchAll(hashtagsRegexp);
		const kindMatches = query.matchAll(kindRegexp);
		const sinceMatch = query.match(sinceRegexp);
		const untilMatch = query.match(untilRegexp);

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
				until = Math.floor(date.getTime() / 1000) + date.getTimezoneOffset() * 60;
			}
		}
		console.debug('[search matches]', fromPubkeys, toPubkeys, hashtags, kinds, since, until);

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

	async fetch(filter: Filter): Promise<EventItem[]> {
		console.debug(
			'[search filter]',
			filter,
			new Date((filter.until ?? 0) * 1000),
			new Date((filter.since ?? 0) * 1000)
		);
		const $pool = get(pool);
		const api = new Api($pool, filter.search !== undefined ? searchRelays : get(readRelays));
		const events = await api.fetchEvents([filter]);
		console.debug('[search events]', events);
		for (const event of events) {
			referencesReqEmit(event);
			authorActionReqEmit(event);
		}
		events.sort(reverseChronological);
		return events.map((event) => new EventItem(event));
	}
}
