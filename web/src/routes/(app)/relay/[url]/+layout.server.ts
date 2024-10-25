import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ params }) => {
	console.log('[relay page load]', params.url);

	const response = await fetch('https://' + params.url, {
		headers: {
			Accept: 'application/nostr+json'
		}
	});
	if (response.ok) {
		const nip11 = await response.json();
		return {
			name: nip11.name as string | undefined,
			url: response.url,
			hostname: response.url.split('/')[2],
			pubkey: nip11.pubkey as string | undefined,
			description: nip11.description as string | undefined,
			icon: nip11.icon as string | undefined
		};
	}

	error(404, 'Not Found');
};
