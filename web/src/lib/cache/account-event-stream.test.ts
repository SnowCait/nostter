import { describe, expect, it, vi } from 'vitest';
import { Subject } from 'rxjs';
import type * as Nostr from 'nostr-typedef';

const cacheAccountEvent = vi.hoisted(() => vi.fn<(_event: Nostr.Event) => Promise<boolean>>());
vi.mock('./Events', () => ({ cacheAccountEvent }));
import { filterStoredAccountEvents } from './account-event-stream';

const event = { id: 'event' } as Nostr.Event;

describe('HomeTimeline account event cache gate', () => {
	it('emits only after a successful current-entry write and suppresses stale events', async () => {
		const first = Promise.withResolvers<boolean>();
		const second = Promise.withResolvers<boolean>();
		cacheAccountEvent
			.mockReset()
			.mockReturnValueOnce(first.promise)
			.mockReturnValueOnce(second.promise);
		const arrivals = new Subject<{ event: Nostr.Event }>();
		const received: Nostr.Event[] = [];
		const firstReceived = Promise.withResolvers<void>();
		const completed = Promise.withResolvers<void>();
		arrivals.pipe(filterStoredAccountEvents()).subscribe({
			next: ({ event }) => {
				received.push(event);
				firstReceived.resolve();
			},
			complete: () => completed.resolve()
		});
		arrivals.next({ event });
		expect(received).toEqual([]);
		first.resolve(true);
		await firstReceived.promise;
		expect(received).toEqual([event]);
		arrivals.next({ event });
		second.resolve(false);
		arrivals.complete();
		await completed.promise;
		expect(cacheAccountEvent).toHaveBeenCalledTimes(2);
		expect(received).toEqual([event]);
	});
});
