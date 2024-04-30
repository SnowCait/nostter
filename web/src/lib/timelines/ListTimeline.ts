import { get, writable } from 'svelte/store';
import { createRxForwardReq, createRxOneshotReq, now, uniq } from 'rx-nostr';
import { Subscription, filter, tap } from 'rxjs';
import type { Event } from 'nostr-typedef';
import { referencesReqEmit, rxNostr } from './MainTimeline';
import { authorActionReqEmit } from '../author/Action';
import { chunk } from '../Array';
import { filterLimitItems, minTimelineLength } from '../Constants';
import { EventItem } from '../Items';
import { Timeline, timelineKinds } from '../Timeline';

let subscription: Subscription | undefined;

export const event = writable<Event | undefined>();
export const pubkeys = writable<string[]>([]);
export const items = writable<EventItem[]>([]);
export const ready = writable(false);

export function clear(): void {
	console.debug('[list page clear]');
	event.set(undefined);
	pubkeys.set([]);
	items.set([]);
	subscription?.unsubscribe();
}

export function subscribeListTimeline(): void {
	console.log('[list timeline subscribe]', pubkeys);

	const $pubkeys = get(pubkeys);
	const since = now();

	const req = createRxForwardReq();
	subscription = rxNostr
		.use(req)
		.pipe(
			uniq(),
			filter(({ event }) => {
				const $items = get(items);
				return !$items.some((x) => x.event.id === event.id);
			}),
			tap(({ event }) => {
				referencesReqEmit(event);
				authorActionReqEmit(event);
			})
		)
		.subscribe(({ event, from }) => {
			console.debug('[list timeline new event]', from, event);
			const item = new EventItem(event);
			const $items = get(items);
			$items.unshift(item);
			items.set($items);
		});

	req.emit(
		chunk($pubkeys, filterLimitItems).map((chunkedAuthors) => {
			return {
				kinds: timelineKinds,
				authors: chunkedAuthors,
				since
			};
		})
	);
}

export async function loadListTimeline(): Promise<void> {
	const $pubkeys = get(pubkeys);
	const $ready = get(ready);
	console.debug('[list timeline load]', $ready, $pubkeys);

	if (!$ready) {
		return;
	}

	const $items = get(items);

	const firstLength = $items.length;
	let count = 0;
	let until =
		$items.length > 0 ? Math.min(...$items.map((item) => item.event.created_at)) : now();
	let seconds = 12 * 60 * 60;

	while ($items.length - firstLength < minTimelineLength && count < 10) {
		const since = until - seconds;
		console.debug('[list timeline period]', new Date(since * 1000), new Date(until * 1000));

		const filters = Timeline.createChunkedFilters($pubkeys, since, until);
		console.debug('[list timeline REQ]', filters, rxNostr.getAllRelayState());
		const pastEventsReq = createRxOneshotReq({ filters });
		console.debug('[list timeline req ID]', pastEventsReq.strategy, pastEventsReq.rxReqId);
		await new Promise<void>((resolve, reject) => {
			rxNostr
				.use(pastEventsReq)
				.pipe(
					uniq(),
					tap(({ event }) => {
						referencesReqEmit(event);
						authorActionReqEmit(event);
					})
				)
				.subscribe({
					next: (packet) => {
						console.debug('[list timeline past event]', packet);
						if (
							!(since <= packet.event.created_at && packet.event.created_at < until)
						) {
							console.warn('[list timeline out of period]', packet, since, until);
							return;
						}
						if ($items.some((x) => x.event.id === packet.event.id)) {
							console.warn('[list timeline duplicate]', packet.event);
							return;
						}
						const item = new EventItem(packet.event);
						const index = $items.findIndex(
							(x) => x.event.created_at < item.event.created_at
						);
						if (index < 0) {
							$items.push(item);
						} else {
							$items.splice(index, 0, item);
						}
						items.set($items);
					},
					complete: () => {
						console.debug('[list timeline complete]', pastEventsReq.rxReqId);
						resolve();
					},
					error: (error) => {
						reject(error);
					}
				});
		});

		until -= seconds;
		seconds *= 2;
		count++;
		console.debug(
			'[list timeline loaded]',
			pastEventsReq.rxReqId,
			count,
			until,
			seconds / 3600,
			$items.length
		);
	}
}
