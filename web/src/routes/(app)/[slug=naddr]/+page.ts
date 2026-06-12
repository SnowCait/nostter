import { nip19 } from 'nostr-tools';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad<{
	slug: string;
	kind: number;
	pubkey: string;
	identifier: string;
	relays: string[];
}> = async ({ params }) => {
	try {
		const { data } = nip19.decode(params.slug);
		const pointer = data as nip19.AddressPointer;
		return {
			slug: params.slug,
			kind: pointer.kind,
			pubkey: pointer.pubkey,
			identifier: pointer.identifier,
			relays: pointer.relays ?? []
		};
	} catch {
		error(404, 'Not Found');
	}
};
