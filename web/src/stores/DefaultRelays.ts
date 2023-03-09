import { readable } from 'svelte/store';

export const defaultRelays = readable([
	'wss://relay.damus.io',
	'wss://relay-jp.nostr.wirednet.jp',
	'wss://nostr-relay.nokotaro.com',
	'wss://nostr.h3z.jp',
	'wss://nostr.holybea.com',
	'wss://relay.nostr.or.jp'
]);
