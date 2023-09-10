import type { Event as NostrEvent } from 'nostr-tools';

export const japaneseBotNpub = 'npub1pp79ruvjd7xned8lgh6n4rhz4pg3els3x5n6kr58l8zcyysp5c0qrkan2p';
export const minTimelineLength = 25;
export const filterLimitItems = 1000;
export const notFoundImageUrl =
	'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f43e.png';

export const hashtagsRegexp = /(?<=^|\s)#(?<hashtag>[\p{Letter}\p{Number}_]+)/gu;

export const searchRelays = [
	'wss://relay.nostr.band',
	'wss://search.nos.today',
	'wss://nostrja-kari-nip50.heguro.com'
];

export const chronological = (x: NostrEvent, y: NostrEvent) => x.created_at - y.created_at;
export const reverseChronological = (x: NostrEvent, y: NostrEvent) => y.created_at - x.created_at;
export const chronologicalItem = (x: { event: NostrEvent }, y: { event: NostrEvent }) =>
	x.event.created_at - y.event.created_at;
export const reverseChronologicalItem = (x: { event: NostrEvent }, y: { event: NostrEvent }) =>
	y.event.created_at - x.event.created_at;

export const onImageError = (event: Event) => {
	const img = event.target as HTMLImageElement;
	img.src = notFoundImageUrl;
};
