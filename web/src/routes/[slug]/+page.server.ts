import { error, redirect } from '@sveltejs/kit';
import { nip19 } from 'nostr-tools';

export function load({ params }) {
	const { slug } = params;
	console.log(slug);

	const { type, data } = nip19.decode(slug);
	console.log(type, data);

	switch (type) {
		case 'npub':
			console.log(`Redirect to /p/${data}`);
			throw redirect(303, `/p/${data}`);
		default:
			throw error(404);
	}
}
