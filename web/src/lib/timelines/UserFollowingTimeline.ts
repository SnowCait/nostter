import { get, writable } from 'svelte/store';
import {
	createRxBackwardReq,
	createRxForwardReq,
	filterByKind,
	latestEach,
	now,
	uniq
} from 'rx-nostr';
import { filter, share, tap, type Subscription } from 'rxjs';
import type { Timeline } from './Timeline';
import { referencesReqEmit, rxNostr } from './MainTimeline';
import { authorActionReqEmit } from '$lib/author/Action';
import { chunk } from '$lib/Array';
import {
	filterLimitItems,
	minTimelineLength,
	followeesKinds,
	timelineLoadSince,
	relatesKinds
} from '$lib/Constants';
import { Timeline as TL } from '$lib/Timeline';
import { fetchMinutes } from '$lib/Helper';
import { EventItem } from '$lib/Items';
import { storeMetadata } from '$lib/cache/Events';

export const timelinesMap = new Map<string, UserFollowingTimeline>();
export const currentPubkey = writable<string | undefined>();

export class UserFollowingTimeline implements Timeline {
	public readonly items = writable<EventItem[]>([]);
	readonly #pubkey: string;
	readonly #followees: string[];
	#newest: number;
	#oldest: number;
	#subscription: Subscription | undefined;

	constructor(pubkey: string, followees: string[]) {
		this.#pubkey = pubkey;
		this.#followees = followees;
		this.#newest = now();
		this.#oldest = this.#newest;
	}

	subscribe(): void {
		console.log(
			'[user following timeline subscribe]',
			this.#pubkey,
			this.#followees.length,
			new Date(this.#newest * 1000)
		);
		const since = this.#newest;
		const req = createRxForwardReq();
		const observable$ = rxNostr.use(req).pipe(uniq(), share());
		observable$
			.pipe(
				filterByKind(0),
				latestEach(({ event }) => event.pubkey),
				tap(({ event }) => console.debug('[rx-nostr metadata event]', event))
			)
			.subscribe(({ event }) => storeMetadata(event));
		this.#subscription = observable$
			.pipe(
				filterByKind(0, { not: true }),
				tap(({ event }) => {
					referencesReqEmit(event);
					authorActionReqEmit(event);
				})
			)
			.subscribe(({ event }) => {
				console.debug('[user following timeline subscribe event]', event);
				const item = new EventItem(event);
				const $items = get(this.items);
				$items.unshift(item);
				this.items.set($items);
			});
		const followeesFilters = chunk(this.#followees, filterLimitItems).map((followees) => ({
			kinds: [0, ...followeesKinds],
			authors: followees,
			since
		}));
		const relatesFilter = {
			kinds: relatesKinds,
			'#p': [this.#pubkey],
			since
		};
		req.emit([...followeesFilters, relatesFilter]);
	}

	unsubscribe(): void {
		console.log('[user following timeline unsubscribe]', this.#pubkey);
		this.#subscription?.unsubscribe();
	}

	async load(): Promise<void> {
		console.log(
			'[user following timeline load]',
			this.#pubkey,
			this.#followees.length,
			new Date(this.#oldest * 1000)
		);
		if (this.#followees.length === 0) {
			return;
		}

		let until = this.#oldest;
		let seconds = fetchMinutes(this.#followees.length) * 60;
		let count = 0;

		while (count < minTimelineLength && until > timelineLoadSince) {
			const since = until - seconds;
			console.debug(
				'[user following timeline period]',
				new Date(since * 1000),
				new Date(until * 1000)
			);

			const followeesFilters = TL.createChunkedFilters(this.#followees, since, until);
			const relatedFilter = {
				kinds: relatesKinds,
				'#p': [this.#pubkey],
				until,
				since
			};
			const filters = [...followeesFilters, relatedFilter];

			const req = createRxBackwardReq();
			const promise = new Promise<void>((resolve) => {
				rxNostr
					.use(req)
					.pipe(
						uniq(),
						filter(
							({ event }) => since <= event.created_at && event.created_at < until
						),
						tap(({ event }) => {
							referencesReqEmit(event);
							authorActionReqEmit(event);
						})
					)
					.subscribe({
						next: async ({ event }) => {
							console.debug('[user following timeline load event]', event);
							const $items = get(this.items);
							if ($items.some((x) => x.event.id === event.id)) {
								console.warn('[user following timeline load duplicate]', event);
								return;
							}
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
							count++;
						},
						complete: () => {
							console.debug('[user following timeline load complete]');
							resolve();
						},
						error: (error) => {
							console.warn('[user following timeline load error]', error);
							resolve();
						}
					});
			});
			req.emit(filters);
			req.over();
			await promise;

			until -= seconds;
			seconds *= 2;
			console.debug('[user following timeline loaded]', count, until, seconds / 3600);
		}

		this.#oldest = until;
	}
}
