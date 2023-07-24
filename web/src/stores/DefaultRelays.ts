import { readable } from 'svelte/store';

export const defaultRelays = readable([
	'wss://nos.lol',
	'wss://relay.damus.io',
	'wss://relay-jp.nostr.wirednet.jp',
	'wss://nostr-relay.nokotaro.com',
	'wss://nostr.holybea.com',
	'wss://nostr.fediverse.jp',
	'wss://yabu.me'
]);
