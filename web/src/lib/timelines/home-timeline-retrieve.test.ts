import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Subject } from 'rxjs';
import { get } from 'svelte/store';
import { kinds as Kind } from 'nostr-tools';
import type * as Nostr from 'nostr-typedef';

const mocks = vi.hoisted(() => ({
	use: vi.fn(),
	notify: vi.fn()
}));
vi.mock('./MainTimeline', () => ({
	rxNostr: { use: mocks.use },
	tie: <T>(source: T): T => source,
	referencesReqEmit: vi.fn(),
	storeSeenOn: vi.fn()
}));
vi.mock('$lib/UserStatus', () => ({ updateUserStatus: vi.fn(), userStatusReqEmit: vi.fn() }));
vi.mock('$lib/author/Action', () => ({
	authorActionReqEmit: vi.fn(),
	updateReactionedEvents: vi.fn(),
	updateRepostedEvents: vi.fn()
}));
vi.mock('$lib/stores/LastNotes', () => ({ saveLastNote: vi.fn() }));
vi.mock('$lib/ToastNotification', () => ({
	ToastNotification: class {
		notify = mocks.notify;
	}
}));
vi.mock('$lib/auth.svelte', () => ({
	auth: { pubkey: 'a'.repeat(64), followees: ['b'.repeat(64)], signer: undefined }
}));

import { HomeTimeline } from './HomeTimeline';
import { notifiedEventItems } from '$lib/author/Notifications';
import { EventItem } from '$lib/Items';

const accountPubkey = 'a'.repeat(64);

function mention(id: string, createdAt: number, pubkey = 'c'.repeat(64)): Nostr.Event {
	return {
		id,
		pubkey,
		kind: Kind.ShortTextNote,
		created_at: createdAt,
		tags: [['p', accountPubkey]],
		content: '',
		sig: 'sig'
	};
}

describe('HomeTimeline retrieve notifications', () => {
	let packets: Subject<{ event: Nostr.Event; from: string }>;
	let timeline: HomeTimeline;

	beforeEach(() => {
		packets = new Subject();
		mocks.use.mockReset().mockReturnValue(packets);
		mocks.notify.mockClear();
		notifiedEventItems.set([]);
		timeline = new HomeTimeline();
		timeline.retrieve(300, 100);
	});

	it('adds notified events in reverse chronological order regardless of arrival order', () => {
		packets.next({ event: mention('middle', 200), from: 'relay.example' });
		packets.next({ event: mention('newest', 250), from: 'relay.example' });
		packets.next({ event: mention('oldest', 150), from: 'relay.example' });

		expect(get(notifiedEventItems).map((item) => item.event.id)).toEqual([
			'newest',
			'middle',
			'oldest'
		]);
		expect(mocks.notify).not.toHaveBeenCalled();
	});

	it('inserts into the existing notifications at the right position', () => {
		notifiedEventItems.set([
			new EventItem(mention('existing-new', 280)),
			new EventItem(mention('existing-old', 50))
		]);

		packets.next({ event: mention('caught-up', 200), from: 'relay.example' });

		expect(get(notifiedEventItems).map((item) => item.event.id)).toEqual([
			'existing-new',
			'caught-up',
			'existing-old'
		]);
	});

	it('does not add an event that is already in the notifications', () => {
		const event = mention('duplicate', 200);
		notifiedEventItems.set([new EventItem(event)]);

		packets.next({ event, from: 'relay.example' });

		expect(get(notifiedEventItems)).toHaveLength(1);
	});

	it('does not add events that are not notifications', () => {
		packets.next({
			event: { ...mention('own', 200, accountPubkey) },
			from: 'relay.example'
		});
		packets.next({
			event: { ...mention('unrelated', 210), tags: [] },
			from: 'relay.example'
		});

		expect(get(notifiedEventItems)).toEqual([]);
	});
});
