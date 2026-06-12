import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import type * as Nostr from 'nostr-typedef';

export const load: LayoutServerLoad = async ({ params }) => {
	try {
		const url = new URL(decodeURIComponent(params.url));
		url.protocol = url.protocol === 'ws:' ? 'http:' : 'https:';
		const response = await fetch(url, {
			headers: {
				Accept: 'application/nostr+json'
			}
		});

		if (!response.ok) {
			throw new Error('NIP-11 is not supported.');
		}

		const nip11: Nostr.Nip11.RelayInfo = await response.json();
		return {
			name: nip11.name,
			url: response.url,
			hostname: response.url.split('/')[2],
			pubkey: nip11.pubkey,
			description: nip11.description,
			icon: nip11.icon
		};
	} catch {
		error(404, 'Not Found');
	}
};
