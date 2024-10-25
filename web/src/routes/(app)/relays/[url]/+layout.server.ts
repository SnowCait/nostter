import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ params }) => {
	console.log('[relay page load]', params.url);

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

		const nip11 = await response.json();
		console.log('[relay page NIP-11]', nip11, response.url);
		return {
			name: nip11.name as string | undefined,
			url: response.url,
			hostname: response.url.split('/')[2],
			pubkey: nip11.pubkey as string | undefined,
			description: nip11.description as string | undefined,
			icon: nip11.icon as string | undefined
		};
	} catch (e) {
		console.error('[relay page error]', e);
		error(404, 'Not Found');
	}
};
