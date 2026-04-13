import { appName } from '$lib/Constants';
import { persistedStore } from '$lib/WebStorage';
import { Handlerinformation } from 'nostr-tools/kinds';

export const ViaOption = ['none', 'once', 'always'] as const;
export type ViaOption = (typeof ViaOption)[number];

export const via = persistedStore<ViaOption>('via:kind:1', 'none', {
	beforeWrite: (value) => {
		if (value === 'once') {
			return 'none';
		}
		return value;
	}
});

export function createViaTag(): string[] {
	return [
		'client',
		appName,
		`${Handlerinformation}:83d52b4363d2d1bc5a098de7be67c120bfb7c0cee8efefd8eb6e42372af24689:1696997648659`,
		'wss://yabu.me/'
	];
}
