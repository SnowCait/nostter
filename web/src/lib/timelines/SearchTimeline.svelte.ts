import { createRxBackwardReq, uniq, type LazyFilter } from 'rx-nostr';
import { filter, tap } from 'rxjs';
import { authorActionReqEmit } from '$lib/author/Action';
import { minTimelineLength, searchRelays } from '$lib/Constants';
import { EventItem } from '$lib/Items';
import { fetchEvents } from '$lib/RxNostrHelper';
import { referencesReqEmit, rxNostr, tie } from './MainTimeline';
import { TimelineSubscriber, type Timeline } from './Timeline.svelte';
import { oldestCreatedAt } from './TimelineHelper';

export class SearchTimeline implements Timeline {
	items = $state.raw<EventItem[]>([]);
	#completed = false;

	constructor(public readonly filter: LazyFilter) {}

	subscribe(): void {
		console.debug('[search timeline subscribe]', this.filter);
	}

	unsubscribe(): void {
		console.debug('[search timeline unsubscribe]', this.filter);
		this.items = [];
	}

	async load(): Promise<void> {
		if (this.#completed) {
			return;
		}

		console.debug('[search timeline load]', this.filter);
		const firstLength = this.items.length;
		const filterBase = { ...this.filter };
		const { promise, resolve } = Promise.withResolvers<void>();
		const req = createRxBackwardReq();
		rxNostr
			.use(req)
			.pipe(
				tie,
				uniq(),
				filter(({ event }) => !this.items.some((item) => item.event.id === event.id)),
				tap(({ event }) => {
					referencesReqEmit(event);
					authorActionReqEmit(event);
				})
			)
			.subscribe({
				next: ({ event }) => {
					console.debug('[search next]', event);
					const item = new EventItem(event);
					const index = this.items.findIndex(
						(x) => x.event.created_at < item.event.created_at
					);
					if (index < 0) {
						this.items = [...this.items, item];
					} else {
						this.items = this.items.toSpliced(index, 0, item);
					}
				},
				complete: () => {
					console.debug('[search complete]', firstLength, this.items.length);
					resolve();
				}
			});
		const until = oldestCreatedAt(this.items);
		req.emit([{ ...filterBase, until, since: until - 15 * 60 }], { relays: searchRelays });
		req.over();
		await promise;

		const length = this.items.length - firstLength;
		if (length < minTimelineLength) {
			const limit = minTimelineLength - length;
			const events = await fetchEvents(
				[{ ...filterBase, until: oldestCreatedAt(this.items), limit }],
				searchRelays
			);
			const _items = events
				.filter((event) => !this.items.some((item) => item.event.id === event.id))
				.splice(0, limit)
				.map((event) => new EventItem(event));
			if (_items.length === 0) {
				this.#completed = true;
			}
			this.items = [...this.items, ..._items];
		}
		console.debug('[search loaded]', firstLength, this.items.length);
	}

	get completed() {
		return this.#completed;
	}
}

export const searchTimeline = new TimelineSubscriber(rxNostr);
