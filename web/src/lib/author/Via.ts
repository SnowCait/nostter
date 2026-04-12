import { appName } from '$lib/Constants';
import { Handlerinformation } from 'nostr-tools/kinds';

export function createViaTag(): string[] {
	return [
		'client',
		appName,
		`${Handlerinformation}:83d52b4363d2d1bc5a098de7be67c120bfb7c0cee8efefd8eb6e42372af24689:1696997648659`,
		'wss://yabu.me/'
	];
}
