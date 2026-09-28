import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Event } from 'nostr-tools';
import { EMPTY, of, throwError } from 'rxjs';
import { rxNostr } from '$lib/relay-client';
import { fetchLatestReplaceableEvent, publishEvent } from './event-operations';

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
