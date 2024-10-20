import { nip57, type Event, nip19 } from 'nostr-tools';
import { decode, type DecodedInvoice } from 'light-bolt11-decoder';
import type { pubkey } from './Types';
import { filterTags } from './EventHelper';

export interface Item {
	readonly event: Event;
}

export class EventItem implements Item {
	constructor(public readonly event: Event) {}

	public get replyToPubkeys(): pubkey[] {
		return [...new Set(filterTags('p', this.event.tags))];
	}

	public get id(): string {
		return this.event.id;
	}
}

export class ZapEventItem extends EventItem {
	private _requestEvent: Event | null | undefined;
	private _amount: number | null | undefined;

	public get requestEvent(): Event | undefined {
		if (this._requestEvent !== undefined) {
			return this._requestEvent ?? undefined;
		}

		const description = this.event.tags.find(([tagName]) => tagName === 'description')?.at(1);
		console.debug('[zap request]', this.event.id, description);
		try {
			this._requestEvent = JSON.parse(description ?? '{}') as Event;
			return this._requestEvent;
		} catch (error) {
			console.warn('[invalid description tag]', error, description);
			this._requestEvent = null;
			return undefined;
		}
	}

	public get invoice(): DecodedInvoice | undefined {
		const bolt11 = this.event.tags.find(([tagName]) => tagName === 'bolt11')?.at(1);
		console.debug('[zap bolt11]', bolt11);

		if (bolt11 === undefined) {
			return undefined;
		}

		try {
			return decode(bolt11);
		} catch (error) {
			console.warn('[zap invalid bolt11]', bolt11, error);
			return undefined;
		}
	}

	public get comment(): string | undefined {
		return this.requestEvent?.content;
	}

	public get amount(): number | undefined {
		if (this._amount !== undefined || this.invoice === undefined) {
			return this._amount ?? undefined;
		}

		try {
			const section = this.invoice.sections.find((section) => section.name === 'amount') as {
				name: 'amount';
				letters: string;
				value: string;
			};
			if (section !== undefined) {
				this._amount = Math.floor(Number(section.value) / 1000);
				return this._amount;
			}
		} catch (error) {
			console.warn('[zap invalid invoice]', this.invoice, error);
			this._amount = null;
			return undefined;
		}
	}
}

export class Metadata implements Item {
	public readonly content: MetadataContent | undefined;
	private _zapUrl: URL | null | undefined;
	constructor(public readonly event: Event) {
		try {
			this.content = JSON.parse(event.content);
		} catch (error) {
			console.warn('[invalid metadata item]', error, event);
		}
	}

	public get id(): string {
		return this.event.id;
	}

	get name(): string {
		if (this.content?.name) {
			return this.content.name;
		} else if (this.content?.display_name) {
			return this.content.display_name;
		} else {
			return alternativeName(this.event.pubkey);
		}
	}

	get displayName(): string {
		if (this.content?.display_name) {
			return this.content.display_name;
		} else if (this.content?.name) {
			return this.content.name;
		} else {
			return alternativeName(this.event.pubkey);
		}
	}

	get picture(): string {
		return this.content?.picture
			? this.getRedirectedUrlIfNostrBuild(this.content.picture)
			: robohash(this.event.pubkey);
	}

	get normalizedNip05(): string {
		if (this.content?.nip05 === undefined || typeof this.content.nip05 !== 'string') {
			return '';
		}

		return this.content.nip05.replace(/^_@/, '');
	}

	get about(): string {
		return this.content?.about ?? '';
	}

	get canZap(): boolean {
		return !(!this.content?.lud16 && !this.content?.lud06);
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
				console.warn('[invalid zap url]', url, error);
				this._zapUrl = null;
			}
		} else {
			this._zapUrl = null;
		}
		return this._zapUrl;
	}

	public startsWith(searchString: string, position?: number | undefined): boolean {
		const lowerCaseSearchString = searchString.toLowerCase();
		return (
			this.name.toLocaleLowerCase().startsWith(lowerCaseSearchString, position) ||
			this.displayName.toLocaleLowerCase().startsWith(lowerCaseSearchString, position) ||
			this.normalizedNip05.toLocaleLowerCase().startsWith(lowerCaseSearchString, position)
		);
	}

	public includes(searchString: string, position?: number | undefined): boolean {
		const lowerCaseSearchString = searchString.toLowerCase();
		return (
			this.name.toLocaleLowerCase().includes(lowerCaseSearchString, position) ||
			this.displayName.toLocaleLowerCase().includes(lowerCaseSearchString, position) ||
			this.normalizedNip05.toLocaleLowerCase().includes(lowerCaseSearchString, position) ||
			nip19.npubEncode(this.event.pubkey).includes(searchString)
		);
	}

	// Workaround for iOS Safari
	private getRedirectedUrlIfNostrBuild(url: string): string {
		if (url.startsWith('https://nostr.build/i/')) {
			return url.startsWith('https://nostr.build/i/p/')
				? url.replace('https://nostr.build/i/p/', 'https://pfp.nostr.build/')
				: url.replace('https://nostr.build/i/', 'https://image.nostr.build/');
		} else if (url.startsWith('https://cdn.nostr.build/i/')) {
			return url.startsWith('https://cdn.nostr.build/i/p/')
				? url.replace('https://cdn.nostr.build/i/p/', 'https://pfp.nostr.build/')
				: url.replace('https://cdn.nostr.build/i/', 'https://image.nostr.build/');
		} else {
			return url;
		}
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

export function robohash(pubkey: string, size = 120): string {
	return `https://robohash.org/${nip19.npubEncode(pubkey)}?set=set4&size=${size}x${size}`;
}

export function alternativeName(pubkey: string): string {
	return nip19.npubEncode(pubkey).slice(0, 'npub1'.length + 7);
}
