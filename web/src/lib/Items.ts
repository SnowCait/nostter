import { nip57, type Event } from 'nostr-tools';
import type { Event as NostrEvent, User } from '../routes/types'; // for compatibility

export interface Item {
	readonly event: Event;
}

export class EventItem implements Item {
	public metadata: Metadata | undefined;
	constructor(public readonly event: Event, metadataEvent: Event | undefined = undefined) {
		if (metadataEvent !== undefined) {
			this.metadata = new Metadata(metadataEvent);
		}
	}

	public async toEvent(): Promise<NostrEvent> {
		return {
			...this.event,
			user: {
				...this.metadata?.content,
				zapEndpoint: (await this.metadata?.zapUrl())?.href ?? null
			} as User
		};
	}
}

export class Metadata implements Item {
	public readonly content: MetadataContent | undefined;
	private _zapUrl: URL | null | undefined;
	constructor(public readonly event: Event) {
		try {
			this.content = JSON.parse(event.content);
		} catch (error) {
			console.warn('[invalid metadata]', error, event);
		}
	}

	public async zapUrl(): Promise<URL | null> {
		if (this._zapUrl !== undefined) {
			return this._zapUrl;
		}

		const url = await nip57.getZapEndpoint(this.event);
		if (url !== null) {
			try {
				this._zapUrl = new URL(url);
			} catch (error) {
				console.warn('[invalid zap url]', url);
				this._zapUrl = null;
			}
		} else {
			this._zapUrl = null;
		}
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
