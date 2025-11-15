import { createRxBackwardReq, createRxForwardReq, now, uniq } from 'rx-nostr';
import { NewTimeline } from './Timeline';
import { referencesReqEmit, rxNostr, tie } from './MainTimeline';
import type { Event } from 'nostr-typedef';
import { get } from 'svelte/store';
import { minTimelineLength, reverseChronological } from '$lib/Constants';
import { filter, tap, type Subscription } from 'rxjs';
import { authorActionReqEmit } from '$lib/author/Action';
import twitter from 'twitter-text';

export const publicTimelines: PublicTimeline[] = [];

const maxTimelineLength = minTimelineLength * 2;

export class PublicTimeline extends NewTimeline {
	readonly #relays: string[];
	#subscription: Subscription | undefined;

	#isTop = true;

	public filter = undefined;

	constructor(relays: string[]) {
		super();

		if (relays.length === 0) {
			throw new Error('No relays');
		}
		this.#relays = relays;
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
				filter(({ event }) => this.#fine(event)),
				tap(({ event }) => {
					referencesReqEmit(event);
					authorActionReqEmit(event);
				})
			)
			.subscribe(({ event }) => {
				const lastId = this.eventsStore.at(0)?.id;
				this.eventsStore.unshift(event);
				this.latestId.set(event.id);
				if (
					this.autoUpdate &&
					this.#isTop &&
					get(this.eventsForView).at(0)?.id === lastId
				) {
					this.eventsForView.set(
						[event, ...get(this.eventsForView)].slice(0, maxTimelineLength)
					);
				}
			});
		req.emit([{ kinds: [1], since: now }]);
	}

	unsubscribe(): void {
		console.debug('[public timeline unsubscribe]');
		this.#subscription?.unsubscribe();
	}

	older(): void {
		console.debug('[public timeline older]', get(this._oldest));

		if (get(this._oldest)) {
			return;
		}

		this._loading = true;
		let count = 0;

		const $eventsForView = get(this.eventsForView);

		if ($eventsForView.length > 0) {
			const index = this.eventsStore.findIndex(
				(event) => event.id === $eventsForView[$eventsForView.length - 1].id
			);
			const events = this.eventsStore.slice(index + 1, index + 1 + minTimelineLength);
			this.eventsForView.set([...$eventsForView, ...events]);
			count += events.length;
			console.debug('[public timeline older from store]', count);
		}

		if (count >= minTimelineLength) {
			this._loading = false;
			return;
		}

		const until = this.eventsStore.at(-1)?.created_at ?? now();

		const req = createRxBackwardReq();
		rxNostr
			.use(req, { on: { relays: this.#relays } })
			.pipe(
				tie,
				uniq(),
				filter(({ event }) => this.#fine(event)),
				tap(({ event }) => {
					referencesReqEmit(event);
					authorActionReqEmit(event);
				})
			)
			.subscribe({
				next: ({ event }) => {
					const index = this.eventsStore.findIndex(
						(e) => e.created_at < event.created_at
					);
					const $eventsForView = get(this.eventsForView);
					if (index < 0) {
						this.eventsStore.push(event);
						this.eventsForView.set([...$eventsForView, event]);
					} else {
						this.eventsStore.splice(index, 0, event);
						const indexForView = $eventsForView.findIndex(
							(e) => e.created_at < event.created_at
						);
						if (indexForView < 0) {
							console.warn('[public timeline logic error]');
						} else {
							$eventsForView.splice(indexForView, 0, event);
							this.eventsForView.set($eventsForView);
						}
					}
					count++;
					if (get(this.latestId) === undefined) {
						this.latestId.set(event.id);
					}
				},
				complete: async () => {
					console.debug('[public timeline older complete]', count);
					if (count < minTimelineLength) {
						const events = await this.fetchEnough(minTimelineLength - count);
						this.eventsStore.push(...events);
						this.eventsForView.set([...get(this.eventsForView), ...events]);
						count += events.length;
						console.debug(
							'[public timeline fetch enough complete]',
							events.length,
							count
						);
					}
					this._loading = false;
					if (count === 0) {
						this._oldest.set(true);
					}
				},
				error: (error) => {
					console.error('[public timeline load older error]', error);
					this._loading = false;
				}
			});
		req.emit([{ kinds: [1], until, since: until - 5 * 60 }]);
		req.over();
	}

	protected async fetchEnough(limit: number): Promise<Event[]> {
		console.debug('[public timeline fetch enough]', limit);
		const { promise, resolve } = Promise.withResolvers<Event[]>();
		const until = this.eventsStore.at(-1)?.created_at ?? now();
		const req = createRxBackwardReq();
		const events: Event[] = [];
		rxNostr
			.use(req, { on: { relays: this.#relays } })
			.pipe(
				// Don't filter before slice
				tie,
				uniq(),
				tap(({ event }) => {
					referencesReqEmit(event);
					authorActionReqEmit(event);
				})
			)
			.subscribe({
				next: ({ event }) => events.push(event),
				complete: () =>
					resolve(
						events
							.toSorted(reverseChronological)
							.slice(0, limit * 2)
							.filter((event) => this.#fine(event))
							.slice(0, limit)
					),
				error: () => resolve([])
			});
		req.emit([{ kinds: [1], until, limit: limit * 2 }]);
		req.over();
		return promise;
	}

	#fine(event: Event): boolean {
		if (this.eventsStore.some((e) => e.id === event.id)) {
			return false;
		}

		if (
			event.tags.some(
				(tag) =>
					tag[0] === 'content-warning' ||
					(tag[0] === 'proxy' && !['rss', 'web'].includes(tag[2]))
			)
		) {
			return false;
		}

		if (event.tags.filter((tag) => tag[0] === 't').length > 5) {
			return false;
		}

		if (event.content.includes('http://')) {
			return false;
		}

		const hashtags = twitter.extractHashtags(event.content);
		if (hashtags.length > event.tags.filter((tag) => tag[0] === 't').length) {
			return false;
		}

		return true;
	}
}
