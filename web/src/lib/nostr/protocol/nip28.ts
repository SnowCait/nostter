import type { Event } from 'nostr-tools';
import type { ChannelMetadata as Nip28ChannelMetadata } from 'nostr-tools/nip28';
import { isValidEventId } from './event-id';

export type ChannelMetadata = Partial<Nip28ChannelMetadata>;

export function findChannelId(tags: string[][]): string | undefined {
	return tags.find(
		([name, value, , marker]) =>
			name === 'e' && (marker === 'root' || marker === undefined) && isValidEventId(value)
	)?.[1];
}

export function parseChannelMetadata(event: Event): ChannelMetadata | undefined {
	try {
		return JSON.parse(event.content);
	} catch (error) {
		console.error('[channel metadata parse error]', error, event);
	}
}
