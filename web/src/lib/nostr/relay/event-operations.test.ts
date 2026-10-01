import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Event } from 'nostr-tools';
import { EMPTY, lastValueFrom, of, throwError, toArray } from 'rxjs';
import { rxNostr } from '$lib/relay-client';
import {
	fetchEvents,
	fetchLatestReplaceableEvent,
	publishEvent,
	requestEvents
} from './event-operations';

const pubkey = 'a'.repeat(64);

function event(created_at: number): Event {
	return {
		id: `${created_at}`.padStart(64, '0'),
		pubkey,
		kind: 10001,
		created_at,
		tags: [],
		content: '',
		sig: 'sig'
	} as Event;
}

afterEach(() => vi.restoreAllMocks());

describe('relay event operations', () => {
	it('sends all filters in a single REQ and returns each received event once', async () => {
		const filters = [
			{ kinds: [10001], authors: [pubkey] },
			{ ids: ['b'.repeat(64)], kinds: [1] }
		];
		const first = event(1);
		const second = event(2);
		const use = vi
			.spyOn(rxNostr, 'use')
			.mockReturnValue(
				of(
					{ event: first, from: 'wss://relay1' },
					{ event: second, from: 'wss://relay1' },
					{ event: first, from: 'wss://relay2' }
				) as never
			);

		await expect(fetchEvents(filters)).resolves.toEqual([first, second]);
		expect(use).toHaveBeenCalledOnce();
		const [req] = use.mock.calls[0];
		await expect(lastValueFrom(req.getReqPacketObservable().pipe(toArray()))).resolves.toEqual([
			{ filters }
		]);
	});

	it('emits all filters once to the given relays and completes the backward request', async () => {
		const filters = [
			{ kinds: [31990], authors: [pubkey], '#d': ['a'], limit: 1 },
			{ kinds: [31990], authors: [pubkey], '#d': ['b'], limit: 1 }
		];
		const on = { relays: ['wss://hint'], defaultReadRelays: true };
		const first = event(1);
		let packets: Promise<unknown[]> | undefined;
		const use = vi.spyOn(rxNostr, 'use').mockImplementation((req) => {
			packets = lastValueFrom(req.getReqPacketObservable().pipe(toArray()));
			return of(
				{ event: first, from: 'wss://hint' },
				{ event: first, from: 'wss://default' }
			) as never;
		});

		await expect(lastValueFrom(requestEvents(filters, on).pipe(toArray()))).resolves.toEqual([
			first
		]);
		expect(use).toHaveBeenCalledOnce();
		expect(use.mock.calls[0][0].strategy).toBe('backward');
		expect(use.mock.calls[0][1]).toEqual({ on });
		await expect(packets).resolves.toEqual([{ filters }]);
	});

	it('returns the latest event after the oneshot request completes', async () => {
		const older = event(1);
		const latest = event(2);
		vi.spyOn(rxNostr, 'use').mockReturnValue(
			of(
				{ event: older, from: 'wss://relay' },
				{ event: latest, from: 'wss://relay' },
				{ event: older, from: 'wss://relay' }
			) as never
		);

		await expect(fetchLatestReplaceableEvent(10001, pubkey)).resolves.toBe(latest);
	});

	it('returns undefined for an empty response and propagates request errors', async () => {
		const use = vi.spyOn(rxNostr, 'use').mockReturnValue(EMPTY as never);
		await expect(fetchLatestReplaceableEvent(10001, pubkey)).resolves.toBeUndefined();

		use.mockReturnValue(throwError(() => new Error('relay unavailable')) as never);
		await expect(fetchLatestReplaceableEvent(10001, pubkey)).rejects.toThrow(
			'relay unavailable'
		);
	});

	it('resolves only after a relay accepts the event', async () => {
		const send = vi
			.spyOn(rxNostr, 'send')
			.mockReturnValue(of({ ok: false }, { ok: true }) as never);

		await expect(publishEvent(event(1))).resolves.toBeUndefined();
		expect(send).toHaveBeenCalledOnce();
	});

	it('rejects when no relay accepts the event or the publish stream errors', async () => {
		const send = vi.spyOn(rxNostr, 'send').mockReturnValue(of({ ok: false }) as never);
		await expect(publishEvent(event(1))).rejects.toThrow();

		send.mockReturnValue(throwError(() => new Error('publish failed')) as never);
		await expect(publishEvent(event(1))).rejects.toThrow('publish failed');
	});
});
