import { describe, expect, it } from 'vitest';
import type { Event } from 'nostr-tools';
import { UserStatuses } from 'nostr-tools/kinds';
import {
	getActiveUserStatus,
	mergeLatestUserStatusEvent,
	type LatestUserStatusEvents
} from './nip38';

const pubkey = 'a'.repeat(64);

function status(type: string, content: string, created_at: number, tags: string[][] = []): Event {
	return {
		id: `${type}-${created_at}`,
		pubkey,
		kind: UserStatuses,
		created_at,
		tags: [['d', type], ...tags],
		content,
		sig: 'sig'
	};
}

function merge(...events: Event[]): LatestUserStatusEvents {
	return events.reduce(mergeLatestUserStatusEvent, new Map() as LatestUserStatusEvents);
}

describe('mergeLatestUserStatusEvent', () => {
	it('keeps the latest event of each status type', () => {
		const latest = merge(
			status('general', 'Working', 1),
			status('music', 'Intergalactic', 2),
			status('general', 'Hiking', 3)
		);

		expect(getActiveUserStatus(latest.get('general'), 0)?.content).toBe('Hiking');
		expect(getActiveUserStatus(latest.get('music'), 0)?.content).toBe('Intergalactic');
	});

	it('does not restore an older status that arrives later', () => {
		const latest = merge(status('general', 'Hiking', 3), status('general', 'Working', 1));

		expect(getActiveUserStatus(latest.get('general'), 0)?.content).toBe('Hiking');
	});

	it('does not restore an older status after the status is cleared', () => {
		const latest = merge(status('general', '', 3), status('general', 'Working', 1));

		expect(getActiveUserStatus(latest.get('general'), 0)).toBeUndefined();
	});

	it('does not restore an older status after the latest one expires', () => {
		const latest = merge(
			status('music', 'Intergalactic', 3, [['expiration', '10']]),
			status('music', 'Sabotage', 1)
		);

		expect(getActiveUserStatus(latest.get('music'), 10)).toBeUndefined();
	});
});

describe('getActiveUserStatus', () => {
	it('excludes a status at its expiration', () => {
		const event = status('music', 'Intergalactic', 1, [['expiration', '10']]);

		expect(getActiveUserStatus(event, 9)).toMatchObject({
			content: 'Intergalactic',
			expiration: 10
		});
		expect(getActiveUserStatus(event, 10)).toBeUndefined();
	});
});
