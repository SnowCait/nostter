import { nip19 } from 'nostr-tools';

export class Nevent {
	static decode(slug: string): nip19.EventPointer {
		const { type, data } = nip19.decode(slug);

		switch (type) {
			case 'note': {
				return {
					id: data as string
				};
			}
			case 'nevent': {
				return data;
			}
			default: {
				throw new Error('Logic error');
			}
		}
	}
}
