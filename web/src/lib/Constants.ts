import { Kind, type Event as NostrEvent } from 'nostr-tools';

export const appName = 'nostter';
export const uriScheme = 'web+nostr';
export const japaneseBotNpub = 'npub1pp79ruvjd7xned8lgh6n4rhz4pg3els3x5n6kr58l8zcyysp5c0qrkan2p';
export const trendingPeopleBotNpub =
	'npub1qsytpsj0pk8pfyk2msyx8ymmvkavn2lg2pxdxsdxufeu83ax5ymsgd4t3w';
export const minTimelineLength = 25;
export const filterLimitItems = 1000;
export const maxFilters = 10;
export const timelineBufferMs = 1500;
export const timeout = 5000;

export const hashtagsRegexp = /(?<=^|\s)#(?<hashtag>[\p{Letter}\p{Number}_]+)/gu;

export const replaceableKinds = [
	Kind.Metadata,
	Kind.Contacts,
	10000,
	10001,
	Kind.RelayList,
	10005,
	10015,
	10030
];
export const parameterizedReplaceableKinds = [30000, 30001, 30078];

export const defaultRelays = [
	{
		url: 'wss://relay.nostr.band/',
		read: true,
		write: true
	},
	{
		url: 'wss://nos.lol/',
		read: true,
		write: true
	},
	{
		url: 'wss://relay.damus.io/',
		read: true,
		write: true
	}
];

export const localizedRelays = {
	ja: [
		{
			url: 'wss://relay-jp.nostr.wirednet.jp/',
			read: true,
			write: true
		},
		{
			url: 'wss://nostr-relay.nokotaro.com/',
			read: true,
			write: true
		},
		{
			url: 'wss://yabu.me/',
			read: true,
			write: true
		},
		{
			url: 'wss://r.kojira.io/',
			read: true,
			write: true
		},
		{
			url: 'wss://nrelay-jp.c-stellar.net/',
			read: true,
			write: true
		}
	]
};

export const searchRelays = [
	'wss://relay.nostr.band',
	'wss://search.nos.today',
	'wss://nostrja-kari-nip50.heguro.com'
];

export const trendRelays = ['wss://nostrbuzzs-relay.fly.dev/'];

export const chronological = (x: NostrEvent, y: NostrEvent) => x.created_at - y.created_at;
export const reverseChronological = (x: NostrEvent, y: NostrEvent) => y.created_at - x.created_at;
export const chronologicalItem = (x: { event: NostrEvent }, y: { event: NostrEvent }) =>
	x.event.created_at - y.event.created_at;
export const reverseChronologicalItem = (x: { event: NostrEvent }, y: { event: NostrEvent }) =>
	y.event.created_at - x.event.created_at;
