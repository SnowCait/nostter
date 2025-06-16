import { createRxBackwardReq, createRxForwardReq, now, uniq } from 'rx-nostr';
import type { NewTimeline } from './Timeline';
import { referencesReqEmit, rxNostr, tie } from './MainTimeline';
import type { Event } from 'nostr-typedef';
import { derived, get, writable } from 'svelte/store';
import { minTimelineLength, reverseChronological } from '$lib/Constants';
import { filter, tap, type Subscription } from 'rxjs';
import { authorActionReqEmit } from '$lib/author/Action';

export const publicTimelines: PublicTimeline[] = [];

const maxTimelineLength = minTimelineLength * 2;

export class PublicTimeline implements NewTimeline {
	readonly #relays: string[];
	readonly #eventsStore: Event[] = [];
	readonly #eventsForView = writable<Event[]>([]);
	#latestId = writable<string | undefined>();
	#oldest = writable(false);
	#subscription: Subscription | undefined;
	public readonly events = derived(this.#eventsForView, ($) => $);
	public readonly latest = derived(
		[this.#latestId, this.#eventsForView],
		([$id, $events]) => $id === $events.at(0)?.id
	);
	public readonly oldest = derived(this.#oldest, ($) => $);

	#autoUpdate: boolean;
	#isTop = true;
	#loading = false;

	constructor(relays: string[], autoUpdate = true) {
		if (relays.length === 0) {
			throw new Error('No relays');
		}
		this.#relays = relays;
		this.#autoUpdate = autoUpdate;
	}

	get autoUpdate(): boolean {
		return this.#autoUpdate;
	}

	get loading(): boolean {
		return this.#loading;
	}

	public setIsTop(isTop: boolean): void {
		this.#isTop = isTop;
	}

	subscribe(): void {
		console.debug('[public timeline subscribe]');
		const req = createRxForwardReq();
		this.#subscription = rxNostr
			.use(req, { on: { relays: this.#relays } })
			.pipe(
				tie,
				uniq(),
				filter(({ event }) => !this.#eventsStore.some((e) => e.id === event.id)),
				filter(
					({ event }) =>
						!event.tags.some(
							(tag) =>
								tag[0] === 'content-warning' ||
								(tag[0] === 'proxy' && !['rss', 'web'].includes(tag[2]))
						)
				),
				filter(({ event }) => event.tags.filter((tag) => tag[0] === 't').length <= 5),
				tap(({ event }) => {
					referencesReqEmit(event);
					authorActionReqEmit(event);
				})
			)
			.subscribe(({ event }) => {
				const lastId = this.#eventsStore.at(0)?.id;
				this.#eventsStore.unshift(event);
				this.#latestId.set(event.id);
				if (
					this.#autoUpdate &&
					this.#isTop &&
					get(this.#eventsForView).at(0)?.id === lastId
				) {
					this.#eventsForView.set(
						[event, ...get(this.#eventsForView)].slice(0, maxTimelineLength)
					);
				}
			});
		req.emit([{ kinds: [1], since: now }]);
	}

	unsubscribe(): void {
		console.debug('[public timeline unsubscribe]');
		this.#subscription?.unsubscribe();
	}

	newer(): void {
		console.debug('[public timeline newer]', get(this.latest));

		if (get(this.latest)) {
			return;
		}

		const $eventsForView = get(this.#eventsForView);
		if ($eventsForView.length === 0) {
			return;
		}

		const latestEvent = $eventsForView[0];
		const index = this.#eventsStore.findIndex((event) => event.id === latestEvent.id);
		if (index > minTimelineLength) {
			const events = this.#eventsStore.slice(index - minTimelineLength, index);
			this.#eventsForView.set([...events, ...$eventsForView].slice(0, maxTimelineLength));
		} else {
			const events = this.#eventsStore.slice(0, index);
			this.#eventsForView.set([...events, ...$eventsForView].slice(0, maxTimelineLength));
		}
	}

	older(): void {
		console.debug('[public timeline older]', get(this.#oldest));

		if (get(this.#oldest)) {
			return;
		}

		this.#loading = true;
		let count = 0;

		const $eventsForView = get(this.#eventsForView);

		if ($eventsForView.length > 0) {
			const index = this.#eventsStore.findIndex(
				(event) => event.id === $eventsForView[$eventsForView.length - 1].id
			);
			const events = this.#eventsStore.slice(index + 1, index + 1 + minTimelineLength);
			this.#eventsForView.set([...$eventsForView, ...events]);
			count += events.length;
			console.debug('[public timeline older from store]', count);
		}

		if (count >= minTimelineLength) {
			this.#loading = false;
			return;
		}

		const until = this.#eventsStore.at(-1)?.created_at ?? now();

		const req = createRxBackwardReq();
		rxNostr
			.use(req, { on: { relays: this.#relays } })
			.pipe(
				tie,
				uniq(),
				filter(({ event }) => !this.#eventsStore.some((e) => e.id === event.id)),
				filter(
					({ event }) =>
						!event.tags.some(
							(tag) =>
								tag[0] === 'content-warning' ||
								(tag[0] === 'proxy' && !['rss', 'web'].includes(tag[2]))
						)
				),
				filter(({ event }) => event.tags.filter((tag) => tag[0] === 't').length <= 5),
				tap(({ event }) => {
					referencesReqEmit(event);
					authorActionReqEmit(event);
				})
			)
			.subscribe({
				next: ({ event }) => {
					this.#eventsStore.push(event);
					const $eventsForView = get(this.#eventsForView);
					this.#eventsForView.set([...$eventsForView, event]);
					count++;
					if (get(this.#latestId) === undefined) {
						this.#latestId.set(event.id);
					}
				},
				complete: async () => {
					console.debug('[public timeline older complete]', count);
					if (count < minTimelineLength) {
						const events = await this.#fetchEnough(minTimelineLength - count);
						this.#eventsStore.push(...events);
						this.#eventsForView.set([...get(this.#eventsForView), ...events]);
						count += events.length;
						console.debug(
							'[public timeline fetch enough complete]',
							events.length,
							count
						);
					}
					this.#loading = false;
					if (count === 0) {
						this.#oldest.set(true);
					}
				},
				error: (error) => {
					console.error('[public timeline load older error]', error);
					this.#loading = false;
				}
			});
		req.emit([{ kinds: [1], until, since: until - 5 * 60 }]);
		req.over();
	}

	public reduce(): void {
		const $eventsForView = get(this.#eventsForView);
		this.#eventsForView.set($eventsForView.slice(-minTimelineLength));
	}

	async #fetchEnough(limit: number): Promise<Event[]> {
		console.debug('[public timeline fetch enough]', limit);
		const { promise, resolve } = Promise.withResolvers<Event[]>();
		const until = this.#eventsStore.at(-1)?.created_at ?? now();
		const req = createRxBackwardReq();
		const events: Event[] = [];
		rxNostr
			.use(req, { on: { relays: this.#relays } })
			.pipe(
				tie,
				uniq(),
				filter(({ event }) => !this.#eventsStore.some((e) => e.id === event.id)),
				filter(
					({ event }) =>
						!event.tags.some(
							(tag) =>
								tag[0] === 'content-warning' ||
								(tag[0] === 'proxy' && !['rss', 'web'].includes(tag[2]))
						)
				),
				filter(({ event }) => event.tags.filter((tag) => tag[0] === 't').length <= 5),
				tap(({ event }) => {
					referencesReqEmit(event);
					authorActionReqEmit(event);
				})
			)
			.subscribe({
				next: ({ event }) => events.push(event),
				complete: () => resolve(events.toSorted(reverseChronological).slice(0, limit)),
				error: () => resolve([])
			});
		req.emit([{ kinds: [1], until, limit }]);
		req.over();
		return promise;
	}

	[Symbol.dispose]() {
		this.unsubscribe();
	}
}
