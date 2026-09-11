import type { Event } from 'nostr-tools';
import type { ChannelMetadata as Nip28ChannelMetadata } from 'nostr-tools/nip28';

export type ChannelMetadata = Partial<Nip28ChannelMetadata>;

export function parseChannelMetadata(event: Event): ChannelMetadata | undefined {
	try {
		return JSON.parse(event.content);
	} catch (error) {
		console.error('[channel metadata parse error]', error, event);
	}
}
