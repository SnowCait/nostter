import { minTimelineLength } from '$lib/Constants';
import { autoRefresh } from '$lib/stores/Preference';
import type { Event } from 'nostr-typedef';
import { derived, get, writable } from 'svelte/store';

export interface Timeline {
	subscribe(): void;
	unsubscribe(): void;
	load(): Promise<void>;
}

const maxTimelineLength = minTimelineLength * 2;

export abstract class NewTimeline {
	//#region Events

	protected readonly eventsStore: Event[] = [];
	protected readonly eventsForView = writable<Event[]>([]);
	public readonly events = derived(this.eventsForView, ($) => $);

	protected latestId = writable<string | undefined>();
	public readonly latest = derived(
		[this.latestId, this.eventsForView],
		([$id, $events]) => $id === $events.at(0)?.id
	);

	public get isLatest(): boolean {
		return get(this.latest);
	}

	protected _oldest = writable(false);
	public readonly oldest = derived(this._oldest, ($) => $);

	//#endregion

	//#region Auto Update

	public get autoUpdate(): boolean {
		return get(autoRefresh);
	}

	//#endregion

	//#region Loading

	protected _loading = false;

	get loading(): boolean {
		return this._loading;
	}

	//#endregion

	public abstract filter: ((event: Event) => boolean) | undefined;

	public abstract setIsTop(isTop: boolean): void;

	public abstract subscribe(): void;

	public abstract unsubscribe(): void;

	public newer(): void {
		if (get(this.latest)) {
			return;
		}

		const $eventsForView = get(this.eventsForView);
		if ($eventsForView.length === 0) {
			return;
		}

		const latestEvent = $eventsForView[0];
		const index = this.eventsStore.findIndex((event) => event.id === latestEvent.id);
		if (index > minTimelineLength) {
			const events = this.eventsStore.slice(index - minTimelineLength, index);
			this.eventsForView.set([...events, ...$eventsForView].slice(0, maxTimelineLength));
		} else {
			const events = this.eventsStore.slice(0, index);
			this.eventsForView.set([...events, ...$eventsForView].slice(0, maxTimelineLength));
		}
	}

	public abstract older(): void;

	public reduce(): void {
		const $eventsForView = get(this.eventsForView);
		this.eventsForView.set($eventsForView.slice(-minTimelineLength));
	}

	public scrollToTop(): void {
		this.eventsForView.set(this.eventsStore.slice(0, minTimelineLength));
	}

	public [Symbol.dispose](): void {
		this.unsubscribe();
	}
}
