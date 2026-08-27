import type * as Nostr from 'nostr-typedef';
import type { Writable } from 'svelte/store';
import {
	getBookmarkListTabs,
	getInitialBookmarkListId,
	standardBookmarkListId
} from './BookmarkListTabs';

type LoadPublicItems<T> = (event: Nostr.Event, addItem: (item: T) => void) => () => void;

export class BookmarkPageState<T> {
	publicBookmarkEventItems: T[] = $state([]);
	publicLegacyBookmarkEventItems: T[] = $state([]);
	selectedBookmarkListId = $state(standardBookmarkListId);
	selectionFinalized = $state(false);

	#bookmarkEvent: Nostr.Event | undefined = $state();
	#legacyBookmarkEvent: Nostr.Event | undefined = $state();
	#unsubscribeBookmarkEvent: () => void;
	#unsubscribeLegacyBookmarkEvent: () => void;
	#cleanupPublicBookmarks: (() => void) | undefined;
	#cleanupPublicLegacyBookmarks: (() => void) | undefined;

	bookmarkListTabs = $derived(getBookmarkListTabs(this.#legacyBookmarkEvent !== undefined));
	hasStandardBookmarks = $derived(this.#bookmarkEvent !== undefined);

	constructor(
		bookmarkEvent: Writable<Nostr.Event | undefined>,
		legacyBookmarkEvent: Writable<Nostr.Event | undefined>,
		loadPublicItems: LoadPublicItems<T>,
		compareItems: (a: T, b: T) => number
	) {
		this.#unsubscribeBookmarkEvent = bookmarkEvent.subscribe((event) => {
			this.#bookmarkEvent = event;
			this.#finalizeInitialSelection();
			this.#cleanupPublicBookmarks?.();
			this.#cleanupPublicBookmarks = undefined;
			this.publicBookmarkEventItems = [];
			if (event === undefined) {
				return;
			}
			this.#cleanupPublicBookmarks = loadPublicItems(event, (item) => {
				this.publicBookmarkEventItems = [...this.publicBookmarkEventItems, item].sort(
					compareItems
				);
			});
		});

		this.#unsubscribeLegacyBookmarkEvent = legacyBookmarkEvent.subscribe((event) => {
			this.#legacyBookmarkEvent = event;
			this.#finalizeInitialSelection();
			this.#cleanupPublicLegacyBookmarks?.();
			this.#cleanupPublicLegacyBookmarks = undefined;
			this.publicLegacyBookmarkEventItems = [];
			if (event === undefined) {
				return;
			}
			this.#cleanupPublicLegacyBookmarks = loadPublicItems(event, (item) => {
				this.publicLegacyBookmarkEventItems = [
					...this.publicLegacyBookmarkEventItems,
					item
				].sort(compareItems);
			});
		});
	}

	#finalizeInitialSelection(): void {
		const standardEventAvailable = this.#bookmarkEvent !== undefined;
		const legacyEventAvailable = this.#legacyBookmarkEvent !== undefined;
		if (this.selectionFinalized || (!standardEventAvailable && !legacyEventAvailable)) {
			return;
		}
		this.selectedBookmarkListId = getInitialBookmarkListId(
			standardEventAvailable,
			legacyEventAvailable
		);
		this.selectionFinalized = true;
	}

	selectBookmarkList(id: string): void {
		this.selectedBookmarkListId = id;
		this.selectionFinalized = true;
	}

	destroy(): void {
		this.#unsubscribeBookmarkEvent();
		this.#unsubscribeLegacyBookmarkEvent();
		this.#cleanupPublicBookmarks?.();
		this.#cleanupPublicLegacyBookmarks?.();
	}
}
