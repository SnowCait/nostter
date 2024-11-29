import { Kind, type Event as NostrEvent } from 'nostr-tools';
import { unique } from './Array';

export const appName = 'nostter';
export const uriScheme = 'web+nostr';
export const japaneseBotNpub = 'npub1pp79ruvjd7xned8lgh6n4rhz4pg3els3x5n6kr58l8zcyysp5c0qrkan2p';
export const trendingPeopleBotNpub =
	'npub1qsytpsj0pk8pfyk2msyx8ymmvkavn2lg2pxdxsdxufeu83ax5ymsgd4t3w';
export const minTimelineLength = 25;
export const timelineLoadSince = Math.floor(new Date(2022, 0, 1).getTime() / 1000);
export const filterLimitItems = 1000;
export const filterLimit = 500;
export const maxFilters = 10;
export const timelineBufferMs = 1500;
export const timeout = 5000;

export const hashtagsRegexp =
	/(?<=^|\s)#(?<hashtag>[\p{XID_Continue}\p{Extended_Pictographic}\p{Emoji_Component}_]+)/gu;

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
export const parameterizedReplaceableKinds = [30000, 30001, 30007, 30008, 30078];

export const notesKinds = [1, 42];
export const notesFilterKinds = [1, 6];
export const followeesFilterKinds = [
	...notesFilterKinds,
	Kind.ChannelCreation,
	Kind.ChannelMessage
];
export const relatesFilterKinds = [...notesFilterKinds, Kind.ChannelMessage];
export const notificationsFilterKinds = [
	...relatesFilterKinds,
	Kind.EncryptedDirectMessage,
	Kind.Reaction,
	Kind.BadgeAward,
	Kind.Zap
];

export const homeFolloweesFilterKinds = [...followeesFilterKinds, Kind.Metadata, 5, 30315];

type AuthorReplaceableKind = {
	kind: number;
	identifier?: string;
};

export const authorReplaceableKinds: AuthorReplaceableKind[] = [
	...replaceableKinds.map((kind) => {
		return { kind };
	}),
	{ kind: 30001, identifier: 'bookmark' },
	{ kind: 30007, identifier: '6' },
	{ kind: 30007, identifier: '7' },
	{ kind: 30007, identifier: '9735' },
	{ kind: 30008, identifier: 'profile_badges' },
	{ kind: 30078, identifier: 'nostter-preferences' },
	{ kind: 30078, identifier: 'nostter-reaction-emoji' },
	{ kind: 30078, identifier: 'nostter-read' }
];

export const authorFilterReplaceableKinds = unique(authorReplaceableKinds.map(({ kind }) => kind));

export const authorFilterKinds = [5, Kind.Reaction];

export const authorHashtagsFilterKinds = [Kind.Text];

export const categoriesKinds = {
	notes: [1],
	reposts: [6, 16],
	reactions: [7],
	channels: [40, 41, 42],
	zaps: [9735]
};

export const categories = Object.keys(categoriesKinds);

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
	'wss://relay.noswhere.com',
	'wss://nostr.wine',
	'wss://search.nos.today',
	'wss://nostrja-kari-nip50.heguro.com'
];

export const trendRelays = ['wss://nostrbuzzs-relay.fly.dev/'];

export const fileStorageServers = [
	'https://nostrcheck.me',
	'https://nostr.build',
	'https://void.cat',
	'https://files.sovbit.host',
	'https://nostpic.com',
	'https://yabu.me'
];

export const imageOptimizerServers = [
	'https://api.yabu.me/v0/images/optimize/',
	'https://nostr-image-optimizer.ocknamo.com/image/'
];

export const chronological = (x: NostrEvent, y: NostrEvent) => x.created_at - y.created_at;
export const reverseChronological = (x: NostrEvent, y: NostrEvent) => y.created_at - x.created_at;
export const chronologicalItem = (x: { event: NostrEvent }, y: { event: NostrEvent }) =>
	x.event.created_at - y.event.created_at;
export const reverseChronologicalItem = (x: { event: NostrEvent }, y: { event: NostrEvent }) =>
	y.event.created_at - x.event.created_at;
