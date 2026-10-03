import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Event } from 'nostr-tools';
import { UserStatuses } from 'nostr-tools/kinds';
import { EMPTY, type Observable } from 'rxjs';
import { UserStatusRegistry } from './user-statuses.svelte';

vi.mock('$lib/nostr/relay/event-operations', () => ({ requestEvents: vi.fn() }));

const alice = 'a'.repeat(64);
const bob = 'b'.repeat(64);
const start = 1_700_000_000;

function status(type: string, content: string, created_at: number, tags: string[][] = []): Event {
	return {
		id: `${type}-${created_at}`,
		pubkey: alice,
		kind: UserStatuses,
		created_at,
		tags: [['d', type], ...tags],
		content,
		sig: 'sig'
	};
}

function setup() {
	const request = vi.fn<(pubkeys: string[]) => Observable<Event>>(() => EMPTY);
	return { registry: new UserStatusRegistry({ request }), request };
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(start * 1000);
});

afterEach(() => {
	vi.useRealTimers();
});

describe('UserStatusRegistry', () => {
	it('stops displaying a status when it expires without a new event', () => {
		const { registry } = setup();
		registry.ingest(status('music', 'Intergalactic', start, [['expiration', `${start + 60}`]]));
		registry.ingest(status('general', 'Working', start));
		registry.observe(alice);

		vi.advanceTimersByTime(59_000);
		expect(registry.get(alice).music?.content).toBe('Intergalactic');

		vi.advanceTimersByTime(1_000);
		expect(registry.get(alice).music).toBeUndefined();
		expect(registry.get(alice).general?.content).toBe('Working');
	});

	it('does not leave an expiration timer after the last observer releases', () => {
		const { registry } = setup();
		registry.ingest(status('music', 'Intergalactic', start, [['expiration', `${start + 60}`]]));
		const release = registry.observe(alice);
		const releaseAgain = registry.observe(alice);
		vi.advanceTimersByTime(1_000);
		expect(vi.getTimerCount()).toBe(1);

		release();
		expect(vi.getTimerCount()).toBe(1);
		releaseAgain();
		expect(vi.getTimerCount()).toBe(0);
	});

	it('does not display unknown status types as general or music', () => {
		const { registry } = setup();
		registry.ingest(status('gaming', 'Playing', start));
		registry.observe(alice);

		expect(registry.get(alice)).toEqual({});
	});

	it('links only HTTP(S) status URLs', () => {
		const { registry } = setup();
		registry.ingest(status('general', 'Working', start, [['r', 'https://nostter.app/']]));
		registry.ingest(
			status('music', 'Intergalactic', start, [['r', 'spotify:search:Intergalactic']])
		);

		const { general, music } = registry.get(alice);
		expect(general?.link?.href).toBe('https://nostter.app/');
		expect(music?.content).toBe('Intergalactic');
		expect(music?.link).toBeUndefined();
	});

	it('requests statuses once per pubkey in a batch', () => {
		const { registry, request } = setup();
		registry.observe(alice);
		registry.observe(alice);
		registry.observe(bob);
		vi.runOnlyPendingTimers();
		registry.observe(alice);
		vi.runOnlyPendingTimers();

		expect(request).toHaveBeenCalledOnce();
		expect(request).toHaveBeenCalledWith([alice, bob]);
	});
});
