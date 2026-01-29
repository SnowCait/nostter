import { minTimelineLength } from '$lib/Constants';
import { autoRefresh } from '$lib/stores/Preference';
import type { Event } from 'nostr-typedef';
import { get } from 'svelte/store';

export interface Timeline {
	subscribe(): void;
	unsubscribe(): void;
	load(): Promise<void>;
}

const maxTimelineLength = minTimelineLength * 2;

export abstract class NewTimeline {
	//#region Events

	protected readonly eventsStore: Event[] = [];
	protected eventsForView = $state.raw<Event[]>([]);
	public readonly events = $derived(this.eventsForView);

	protected latestId = $state<string | undefined>();
	public readonly latest = $derived(this.latestId === this.eventsForView.at(0)?.id);

	protected _oldest = $state(false);
	public readonly oldest = $derived(this._oldest);

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
		if (this.latest) {
			return;
		}

		if (this.eventsForView.length === 0) {
			return;
		}

		const latestEvent = this.eventsForView[0];
		const index = this.eventsStore.findIndex((event) => event.id === latestEvent.id);
		if (index > minTimelineLength) {
			const events = this.eventsStore.slice(index - minTimelineLength, index);
			this.eventsForView = [...events, ...this.eventsForView].slice(0, maxTimelineLength);
		} else {
			const events = this.eventsStore.slice(0, index);
			this.eventsForView = [...events, ...this.eventsForView].slice(0, maxTimelineLength);
		}
	}

	public abstract older(): void;

	public reduce(): void {
		this.eventsForView = this.eventsForView.slice(-minTimelineLength);
	}

	public scrollToTop(): void {
		this.eventsForView = this.eventsStore.slice(0, minTimelineLength);
	}

	//#region Reactivated

	public clear(): void {
		this.eventsStore.splice(0);
		this.eventsForView = [];
		this.latestId = undefined;
		this._oldest = false;
	}

	public abstract retrieve(until: number, since: number): void;

	//#endregion

	public [Symbol.dispose](): void {
		this.unsubscribe();
	}
}
