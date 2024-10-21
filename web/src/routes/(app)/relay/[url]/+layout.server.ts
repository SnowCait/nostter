import { error } from '@sveltejs/kit';
import type { Event } from 'nostr-typedef';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad<{
	pubkey: string;
	relays: string[];
	metadataEvent: Event | undefined;
}> = async ({ params }) => {
	console.log('[relay page load]', params.url);
	console.time('[relay check]');

	const response = await fetch('https://' + params.url, {
		headers: {
			Accept: 'application/nostr+json'
		}
	});
	if (response.ok) {
		const nip11 = await response.json();
		return {
			name: nip11.name,
			url: response.url,
			hostname: response.url.split('/')[2],
			pubkey: nip11.pubkey,
			description: nip11.description,
			icon: nip11.icon
		};
	}

	error(404, 'Not Found');
};
