import { nip19 } from 'nostr-tools';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad<{
	naddr: string;
	kind: number;
	pubkey: string;
	identifier: string;
	relays: string[];
}> = async ({ params }) => {
	console.log('[list page load]', params.slug, params.naddr);
	try {
		const { type, data } = nip19.decode(params.naddr);
		console.log('[list page naddr decode]', data);
		const pointer = data as nip19.AddressPointer;

		if (type !== 'naddr' || pointer.kind !== 30000) {
			error(400);
		}

		return {
			naddr: params.naddr,
			kind: pointer.kind,
			pubkey: pointer.pubkey,
			identifier: pointer.identifier,
			relays: pointer.relays ?? []
		};
	} catch (e) {
		console.error('[list page naddr decode error]', e);
		error(404, 'Not Found');
	}
};
