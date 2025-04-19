import { createRxBackwardReq, uniq, type LazyFilter } from 'rx-nostr';
import { filter, tap } from 'rxjs';
import { get, writable } from 'svelte/store';
import { authorActionReqEmit } from '$lib/author/Action';
import { minTimelineLength, searchRelays } from '$lib/Constants';
import { EventItem } from '$lib/Items';
import { fetchEvents } from '$lib/RxNostrHelper';
import { referencesReqEmit, rxNostr } from './MainTimeline';
import type { Timeline } from './Timeline';
import { oldestCreatedAt } from './TimelineHelper';

export class SearchTimeline implements Timeline {
	items = writable<EventItem[]>([]);
	#completed = false;

	constructor(public readonly filter: LazyFilter) {}

	subscribe(): void {
		console.debug('[search timeline subscribe]', this.filter);
	}

	unsubscribe(): void {
		console.debug('[search timeline unsubscribe]', this.filter);
		this.items.set([]);
	}

	async load(): Promise<void> {
		if (this.#completed) {
			return;
		}

		console.debug('[search timeline load]', this.filter);
		const $items = get(this.items);
		const firstLength = $items.length;
		const filterBase = { ...this.filter };
		const { promise, resolve } = Promise.withResolvers<void>();
		const req = createRxBackwardReq();
		rxNostr
			.use(req)
			.pipe(
				uniq(),
				filter(({ event }) => !$items.some((item) => item.event.id === event.id)),
				tap(({ event }) => {
					referencesReqEmit(event);
					authorActionReqEmit(event);
				})
			)
			.subscribe({
				next: ({ event }) => {
					console.debug('[search next]', event);
					const item = new EventItem(event);
					const index = $items.findIndex(
						(x) => x.event.created_at < item.event.created_at
					);
					if (index < 0) {
						$items.push(item);
					} else {
						$items.splice(index, 0, item);
					}
					this.items.set($items);
				},
				complete: () => {
					console.debug('[search complete]', firstLength, $items.length);
					resolve();
				}
			});
		const until = oldestCreatedAt($items);
		req.emit([{ ...filterBase, until, since: until - 15 * 60 }], { relays: searchRelays });
		req.over();
		await promise;

		const length = $items.length - firstLength;
		if (length < minTimelineLength) {
			const limit = minTimelineLength - length;
			const events = await fetchEvents(
				[{ ...filterBase, until: oldestCreatedAt($items), limit }],
				searchRelays
			);
			const _items = events
				.filter((event) => !$items.some((item) => item.event.id === event.id))
				.splice(0, limit)
				.map((event) => new EventItem(event));
			if (_items.length === 0) {
				this.#completed = true;
			}
			$items.push(..._items);
			this.items.set($items);
		}
		console.log('[search loaded]', firstLength, $items.length);
	}

	get completed() {
		return this.#completed;
	}
}
