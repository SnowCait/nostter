import { nip19 } from 'nostr-tools';
import { error } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad<{
	naddr: string;
	kind: number;
	pubkey: string;
	identifier: string;
	relays: string[];
}> = async ({ params }) => {
	try {
		const { type, data } = nip19.decode(params.naddr);
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
	} catch {
		error(404, 'Not Found');
	}
};
