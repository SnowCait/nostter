import { nip57, type Event } from 'nostr-tools';
import type { Event as NostrEvent, User } from '../routes/types'; // for compatibility

interface Item {
	readonly event: Event;
}

export class EventItem implements Item {
	public readonly metadata: Metadata | undefined;
	constructor(public readonly event: Event, metadataEvent: Event | undefined = undefined) {
		if (metadataEvent !== undefined) {
			this.metadata = new Metadata(metadataEvent);
		}
	}

	public toEvent(): NostrEvent {
		return {
			...this.event,
			user: {
				...this.metadata?.content,
				zapEndpoint: this.metadata?.zapUrl?.href ?? null
			} as User
		};
	}
}

export class Metadata implements Item {
	public readonly content: MetadataContent | undefined;
	private _zapUrl: URL | undefined;
	constructor(public readonly event: Event) {
		try {
			this.content = JSON.parse(event.content);
			nip57.getZapEndpoint(event).then((url) => {
				if (url !== null) {
					this._zapUrl = new URL(url);
				}
			});
		} catch (error) {
			console.warn('[invalid metadata]', error, event);
		}
	}

	get zapUrl(): URL | undefined {
		return this._zapUrl;
	}
}

export interface MetadataContent {
	name: string;
	display_name: string;
	nip05: string;
	picture: string;
	banner: string;
	website: string;
	about: string;
	lud06: string;
	lud16: string;
}
