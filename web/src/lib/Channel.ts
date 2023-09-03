import type { Event } from 'nostr-tools';
import type { ChannelMetadata } from './Types';
import { writable, type Writable } from 'svelte/store';

export const channelIdStore: Writable<string | undefined> = writable();

export class Channel {
	static parseMetadata(event: Event): ChannelMetadata | undefined {
		try {
			return JSON.parse(event.content);
		} catch (error) {
			console.error('[channel metadata parse error]', error, event);
		}
	}
}
