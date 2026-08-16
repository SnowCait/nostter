import { get } from 'svelte/store';
import { beforeEach, describe, expect, it } from 'vitest';
import type * as Nostr from 'nostr-typedef';
import { legacyProfileBadgesKind, profileBadgesKind } from '$lib/ProfileBadgesEvent';
import {
	profileBadgesEvent,
	setProfileBadgesEvent,
	updateProfileBadgesEvent
} from './ProfileBadges';

function event(kind: number, created_at: number, id: string, tags: string[][] = []): Nostr.Event {
	return {
		kind,
		created_at,
		id,
		tags,
		pubkey: 'pubkey',
		content: '',
		sig: ''
	};
}

describe('profileBadgesEvent', () => {
	beforeEach(() => profileBadgesEvent.set(undefined));

	it('initializes from current and legacy events', () => {
		const current = event(profileBadgesKind, 2, 'current');
		const legacy = event(legacyProfileBadgesKind, 1, 'legacy', [['d', 'profile_badges']]);

		setProfileBadgesEvent(current, legacy);

		expect(get(profileBadgesEvent)).toBe(current);
	});

	it('initializes from a legacy event only', () => {
		const legacy = event(legacyProfileBadgesKind, 1, 'legacy', [['d', 'profile_badges']]);

		setProfileBadgesEvent(undefined, legacy);

		expect(get(profileBadgesEvent)).toBe(legacy);
	});

	it('updates when a current event arrives in real time', () => {
		const current = event(profileBadgesKind, 2, 'current');

		updateProfileBadgesEvent(current);

		expect(get(profileBadgesEvent)).toBe(current);
	});

	it('updates when a legacy event arrives in real time', () => {
		const legacy = event(legacyProfileBadgesKind, 2, 'legacy', [['d', 'profile_badges']]);

		updateProfileBadgesEvent(legacy);

		expect(get(profileBadgesEvent)).toBe(legacy);
	});

	it('ignores badge set events', () => {
		const current = event(profileBadgesKind, 1, 'current');
		const badgeSet = event(legacyProfileBadgesKind, 2, 'set', [['d', 'set']]);
		profileBadgesEvent.set(current);

		updateProfileBadgesEvent(badgeSet);

		expect(get(profileBadgesEvent)).toBe(current);
	});
});
