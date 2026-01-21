import {
	createRxBackwardReq,
	createRxForwardReq,
	filterAsync,
	filterByKind,
	filterByKinds,
	latestEach,
	now,
	uniq,
	type LazyFilter
} from 'rx-nostr';
import { filter, share, tap } from 'rxjs';
import type { Event } from 'nostr-typedef';
import { referencesReqEmit, rxNostr, storeSeenOn, tie } from './MainTimeline';
import { persistedStore, WebStorage } from '$lib/WebStorage';
import { kinds as Kind } from 'nostr-tools';
import { get } from 'svelte/store';
import { bookmarkEvent } from '$lib/author/Bookmark';
import {
	authorActionReqEmit,
	updateReactionedEvents,
	updateRepostedEvents
} from '$lib/author/Action';
import { customEmojiListEvent, storeCustomEmojis } from '$lib/author/CustomEmojis';
import { profileBadgesEvent } from '$lib/author/ProfileBadges';
import { authorChannelsEventStore, storeMetadata } from '$lib/cache/Events';
import { updateFolloweesStore } from '$lib/Contacts';
import { findIdentifier } from '$lib/EventHelper';
import { Preferences, preferencesStore } from '$lib/Preferences';
import { followingHashtags, updateFollowingHashtags } from '$lib/Interest';
import { EventItem } from '$lib/Items';
import { ToastNotification } from '$lib/ToastNotification';
import { chunk } from '$lib/Array';
import {
	homeFolloweesFilterKinds,
	filterLimitItems,
	parameterizedReplaceableKinds,
	replaceableKinds,
	authorFilterReplaceableKinds,
	authorFilterKinds,
	authorHashtagsFilterKinds,
	notificationsFilterKinds,
	minTimelineLength,
	reverseChronological,
	followeesFilterKinds
} from '$lib/Constants';
import { updateUserStatus, userStatusReqEmit } from '$lib/UserStatus';
import {
	pubkey,
	author,
	updateRelays,
	followees,
	storeMutedPubkeysByKind,
	storeMutedTagsByEvent
} from '../stores/Author';
import { lastReadAt, notifiedEventItems } from '../author/Notifications';
import { saveLastNote } from '../stores/LastNotes';
import { isPeopleList, storePeopleList } from '$lib/author/PeopleLists';
import { storeDeletedEvents } from '$lib/author/Delete';
import { NewTimeline } from './Timeline.svelte';
import { excludeKinds } from '$lib/TimelineFilter';
import { followeesOfFollowees } from '$lib/author/MuteAutomatically';
import { fetchMinutes } from '$lib/Helper';

const maxTimelineLength = minTimelineLength * 2;

export class HomeTimeline extends NewTimeline {
	public filter = (event: Event) =>
		!get(excludeKinds).includes(event.kind) &&
		(!get(preferencesStore).muteAutomatically || get(followeesOfFollowees).has(event.pubkey));

	constructor() {
		super();

		console.debug('[home timeline initialize]');
	}

	//#endregion

	//#region setIsTop

	#isTop = true;

	public setIsTop(isTop: boolean): void {
		this.#isTop = isTop;
	}

	//#endregion

	//#region Subscription

	#req = createRxForwardReq();

	#createSubscriptions(): void {
		console.debug('[home timeline create subscriptions]');
		const $pubkey = get(pubkey);
		if (!$pubkey) {
			console.error('[pubkey is empty]');
			return;
		}
		const observable$ = rxNostr.use(this.#req).pipe(tie, uniq(), share());
		const author$ = observable$.pipe(
			filter(({ event }) => event.pubkey === $pubkey),
			share()
		);
		author$
			.pipe(filterByKind(Kind.Repost))
			.subscribe(({ event }) => updateRepostedEvents([event]));
		author$
			.pipe(filterByKind(Kind.Reaction))
			.subscribe(({ event }) => updateReactionedEvents([event]));
		const replaceable$ = author$.pipe(
			filterByKinds(replaceableKinds),
			latestEach(({ event }) => event.kind),
			filter(({ event }) => {
				const storage = new WebStorage(localStorage);
				const cache = storage.getReplaceableEvent(event.kind);
				return cache === undefined || cache.created_at < event.created_at;
			}),
			tap(({ event }) => {
				console.debug('[author event]', event.kind, event);
				const storage = new WebStorage(localStorage);
				storage.setReplaceableEvent(event);
			}),
			share()
		);
		replaceable$.pipe(filterByKind(Kind.Contacts)).subscribe(({ event }) => {
			updateFolloweesStore(event.tags);
			this.subscribe();
		});
		replaceable$.pipe(filterByKind(Kind.Mutelist)).subscribe(async ({ event }) => {
			await storeMutedTagsByEvent(event);
		});
		replaceable$
			.pipe(filterByKind(Kind.PublicChatsList))
			.subscribe(({ event }) => authorChannelsEventStore.set(event));
		replaceable$
			.pipe(filterByKind(Kind.RelayList))
			.subscribe(({ event }) => updateRelays(event)); // TODO: Update subscription
		replaceable$.pipe(filterByKind(Kind.InterestsList)).subscribe(() => {
			updateFollowingHashtags();
			this.subscribe();
		});
		replaceable$.pipe(filterByKind(Kind.UserEmojiList)).subscribe(({ event }) => {
			customEmojiListEvent.set(event);
			storeCustomEmojis(event);
		});
		const addressable$ = author$.pipe(
			filterByKinds(parameterizedReplaceableKinds),
			latestEach(({ event }) => `${event.kind}:${findIdentifier(event.tags) ?? ''}`),
			filter(({ event }) => {
				const storage = new WebStorage(localStorage);
				const cache = storage.getParameterizedReplaceableEvent(
					event.kind,
					findIdentifier(event.tags) ?? ''
				);
				return cache === undefined || cache.created_at < event.created_at;
			}),
			tap(({ event }) => {
				console.debug('[author event]', event.kind, findIdentifier(event.tags), event);
				const storage = new WebStorage(localStorage);
				storage.setParameterizedReplaceableEvent(event);
			}),
			share()
		);
		addressable$
			.pipe(
				filterByKind(Kind.Followsets),
				filterAsync(({ event }) => isPeopleList(event))
			)
			.subscribe(({ event }) => storePeopleList(event));
		addressable$
			.pipe(
				filterByKind(Kind.Genericlists),
				filter(({ event }) => findIdentifier(event.tags) === 'bookmark')
			)
			.subscribe(({ event }) => bookmarkEvent.set(event));
		addressable$
			.pipe(filterByKind(30007))
			.subscribe(({ event }) => storeMutedPubkeysByKind([event]));
		addressable$
			.pipe(filterByKind(Kind.ProfileBadges))
			.subscribe(({ event }) => profileBadgesEvent.set(event));
		addressable$.pipe(filterByKind(Kind.Application)).subscribe(({ event }) => {
			const identifier = findIdentifier(event.tags);
			if (identifier === 'nostter-read') {
				console.debug('[last read at]', new Date(event.created_at * 1000));
				lastReadAt.set(event.created_at);
			} else if (identifier === 'nostter-preferences') {
				const preferences = new Preferences(event.content);
				preferencesStore.set(preferences);
			}
		});
		observable$
			.pipe(
				filterByKind(Kind.Metadata),
				latestEach(({ event }) => event.pubkey)
			)
			.subscribe(({ event }) => storeMetadata(event));
		observable$
			.pipe(filterByKind(Kind.EventDeletion))
			.subscribe(({ event }) => storeDeletedEvents(event));
		observable$
			.pipe(filterByKind(Kind.BadgeAward))
			.subscribe(({ event, from }) => storeSeenOn(event.id, from)); // TODO: Migrate to tie
		observable$
			.pipe(filterByKind(Kind.UserStatuses))
			.subscribe(({ event }) => updateUserStatus(event));
		const timeline$ = observable$.pipe(
			filterByKinds(
				[
					Kind.EventDeletion,
					Kind.UserStatuses,
					...replaceableKinds,
					...parameterizedReplaceableKinds
				],
				{
					not: true
				}
			),
			filter(({ event }) => !this.eventsStore.some((e) => e.id === event.id)),
			tap(({ event }) => referencesReqEmit(event)),
			share()
		);
		timeline$.subscribe(({ event }) => {
			const lastId = this.eventsStore.at(0)?.id;
			this.eventsStore.unshift(event);
			this.latestId = event.id;
			if (this.autoUpdate && this.#isTop && this.eventsForView.at(0)?.id === lastId) {
				this.eventsForView = [event, ...this.eventsForView].slice(0, maxTimelineLength);
			}
		});
		timeline$
			.pipe(
				filter(({ event }) => get(author)!.isNotified(event)),
				filter(({ event }) => !get(notifiedEventItems).some((x) => x.event.id === event.id))
			)
			.subscribe(({ event }) => {
				const eventItem = new EventItem(event);
				const $notifiedEventItems = get(notifiedEventItems);
				$notifiedEventItems.unshift(eventItem);
				notifiedEventItems.set($notifiedEventItems);

				const toast = new ToastNotification();
				toast.notify(event);
			});
		timeline$
			.pipe(
				filterByKind(Kind.ShortTextNote),
				tap(({ event }) => userStatusReqEmit([event.pubkey]))
			)
			.subscribe(({ event }) => {
				saveLastNote(event);
	
				if (get(options).speech) {
					const utterance = new SpeechSynthesisUtterance(event.content);
					window.speechSynthesis.speak(utterance);
				}
			});
	}

	#createForwardFilters(): LazyFilter[] {
		const $pubkey = get(pubkey);
		const $followees = get(followees);

		const followeesFilter: LazyFilter[] = chunk($followees, filterLimitItems).map(
			(chunkedAuthors) => {
				return {
					kinds: homeFolloweesFilterKinds,
					authors: chunkedAuthors,
					since: now
				};
			}
		);

		const notificationsFilter: LazyFilter = {
			kinds: notificationsFilterKinds,
			'#p': [$pubkey],
			since: now
		};

		const authorFilters: LazyFilter[] = [
			{
				kinds: authorFilterReplaceableKinds,
				authors: [$pubkey]
			},
			{
				kinds: authorFilterKinds,
				authors: [$pubkey],
				since: now
			}
		];

		const $followingHashtags = get(followingHashtags);
		if ($followingHashtags.length > 0) {
			authorFilters.push({
				kinds: authorHashtagsFilterKinds,
				'#t': $followingHashtags,
				since: now
			});
		}

		return [...followeesFilter, notificationsFilter, ...authorFilters];
	}

	#createBackwardFilters(limit?: number): LazyFilter[] {
		const $pubkey = get(pubkey);
		const $followees = get(followees);
		const $followingHashtags = get(followingHashtags);

		const until = this.eventsStore.at(-1)?.created_at ?? now();
		const since = until - fetchMinutes($followees.length) * 60;

		const followeesFilters = chunk($followees, filterLimitItems).map((chunkedAuthors) => {
			return {
				kinds: followeesFilterKinds,
				authors: chunkedAuthors,
				until,
				since: limit ? undefined : since,
				limit
			};
		});

		const authorFilters: LazyFilter[] = [
			{
				kinds: notificationsFilterKinds,
				'#p': [$pubkey],
				until,
				since: limit ? undefined : since,
				limit
			},
			{
				kinds: [Kind.Reaction],
				authors: [$pubkey],
				until,
				since: limit ? undefined : since,
				limit
			}
		];

		if ($followingHashtags.length > 0) {
			authorFilters.push({
				kinds: [Kind.ShortTextNote],
				'#t': $followingHashtags,
				until,
				since: limit ? undefined : since,
				limit
			});
		}

		return [...followeesFilters, ...authorFilters];
	}

	#first = true;

	subscribe(): void {
		if (this.#first) {
			this.#first = false;
			this.#createSubscriptions();
		}
		const filters = this.#createForwardFilters();
		console.debug('[home timeline REQ]', filters);
		this.#req.emit(filters);
	}

	unsubscribe(): void {
		// Noop
	}

	//#endregion

	older(): void {
		if (this._oldest) {
			return;
		}

		this._loading = true;
		let count = 0;

		if (this.eventsForView.length > 0) {
			const index = this.eventsStore.findIndex(
				(event) => event.id === this.eventsForView[this.eventsForView.length - 1].id
			);
			const events = this.eventsStore.slice(index + 1, index + 1 + minTimelineLength);
			this.eventsForView = [...this.eventsForView, ...events];
			count += events.length;
		}

		if (count >= minTimelineLength) {
			this._loading = false;
			return;
		}

		const pubkeys = new Set<string>();
		const req = createRxBackwardReq();
		rxNostr
			.use(req)
			.pipe(
				tie,
				uniq(),
				filter(({ event }) => !this.eventsStore.some((e) => e.id === event.id)),
				tap(({ event }) => {
					referencesReqEmit(event);
					authorActionReqEmit(event);
					pubkeys.add(event.pubkey);
					if (event.kind === Kind.ShortTextNote) {
						saveLastNote(event);
					}
				})
			)
			.subscribe({
				next: ({ event }) => {
					const index = this.eventsStore.findIndex(
						(e) => e.created_at < event.created_at
					);
					if (index < 0) {
						this.eventsStore.push(event);
						this.eventsForView = [...this.eventsForView, event];
					} else {
						this.eventsStore.splice(index, 0, event);
						const indexForView = this.eventsForView.findIndex(
							(e) => e.created_at < event.created_at
						);
						if (indexForView < 0) {
							console.warn('[home timeline logic error');
						} else {
							this.eventsForView.splice(indexForView, 0, event);
						}
					}
					count++;
					if (this.latestId === undefined) {
						this.latestId = event.id;
					}
				},
				complete: async () => {
					console.debug('[home timeline older complete]', count);
					userStatusReqEmit([...pubkeys]);
					if (count < minTimelineLength) {
						const events = await this.#fetchEnough(minTimelineLength - count);
						this.eventsStore.push(...events);
						this.eventsForView = [...this.eventsForView, ...events];
						count += events.length;
						console.debug(
							'[home timeline fetch enough complete]',
							events.length,
							count
						);
					}
					this._loading = false;
					if (count === 0) {
						this._oldest = true;
					}
				},
				error: (error) => {
					console.error('[home timeline load older error]', error);
					this._loading = false;
				}
			});
		const filters = this.#createBackwardFilters();
		console.debug('[home timeline older REQ]', filters);
		req.emit(filters);
		req.over();
	}

	async #fetchEnough(limit: number): Promise<Event[]> {
		const { promise, resolve } = Promise.withResolvers<Event[]>();
		const req = createRxBackwardReq();
		const events: Event[] = [];
		rxNostr
			.use(req)
			.pipe(
				// Don't filter before slice
				tie,
				uniq(),
				tap(({ event }) => {
					referencesReqEmit(event);
					authorActionReqEmit(event);
					if (event.kind === Kind.ShortTextNote) {
						saveLastNote(event);
					}
				})
			)
			.subscribe({
				next: ({ event }) => events.push(event),
				complete: () => {
					const filteredEvents = events
						.toSorted(reverseChronological)
						.slice(0, limit * 2)
						.filter((event) => !this.eventsStore.some((e) => e.id === event.id))
						.slice(0, limit);
					const pubkeys = new Set<string>(filteredEvents.map((e) => e.pubkey));
					userStatusReqEmit([...pubkeys]);
					resolve(filteredEvents);
				},
				error: () => resolve([])
			});
		const filters = this.#createBackwardFilters(limit * 2);
		console.debug('[home timeline fetch enough REQ]', filters);
		req.emit(filters);
		req.over();
		return promise;
	}

	public retrieve(until: number, since: number): void {
		const pubkeys = new Set<string>();
		const req = createRxBackwardReq();
		rxNostr
			.use(req)
			.pipe(
				tie,
				uniq(),
				filter(({ event }) => !this.eventsStore.some((e) => e.id === event.id)),
				tap(({ event }) => {
					referencesReqEmit(event);
					authorActionReqEmit(event);
					pubkeys.add(event.pubkey);
					if (event.kind === Kind.ShortTextNote) {
						saveLastNote(event);
					}
				})
			)
			.subscribe({
				next: ({ event }) => {
					const index = this.eventsStore.findIndex(
						(e) => e.created_at < event.created_at
					);
					if (index < 0) {
						this.eventsStore.push(event);
						this.eventsForView = [...this.eventsForView, event];
					} else {
						this.eventsStore.splice(index, 0, event);
						const indexForView = this.eventsForView.findIndex(
							(e) => e.created_at < event.created_at
						);
						if (indexForView < 0) {
							console.warn('[home timeline logic error');
						} else {
							this.eventsForView.splice(indexForView, 0, event);
						}
					}
					if (this.latestId === undefined) {
						this.latestId = event.id;
					}
				},
				complete: async () => {
					console.debug('[home timeline retrieve complete]');
					userStatusReqEmit([...pubkeys]);
				},
				error: (error) => {
					console.error('[home timeline load retrieve error]', error);
				}
			});
		const filters = this.#createBackwardFilters();
		for (const filter of filters) {
			filter.until = until;
			filter.since = since;
		}
		console.debug('[home timeline retrieve REQ]', filters);
		req.emit(filters);
		req.over();
	}
}

export const timeline = new HomeTimeline();
export const options = persistedStore('preference:timeline:home:options', { speech: false });
