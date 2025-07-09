import type { Event } from 'nostr-typedef';
import type { Readable } from 'svelte/store';

export interface Timeline {
	subscribe(): void;
	unsubscribe(): void;
	load(): Promise<void>;
}

export interface NewTimeline {
	autoUpdate: boolean;
	latest: Readable<boolean>;
	oldest: Readable<boolean>;
	loading: boolean;
	events: Readable<Event[]>;
	setIsTop(isTop: boolean): void;
	subscribe(): void;
	unsubscribe(): void;
	newer(): void;
	older(): void;
	reduce(): void;
	scrollToTop(): void;
	[Symbol.dispose](): void;
}
