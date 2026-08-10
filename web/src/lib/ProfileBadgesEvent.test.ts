import { describe, expect, it } from 'vitest';
import type * as Nostr from 'nostr-typedef';
import {
	addAcceptedBadgeTags,
	isLegacyProfileBadgesEvent,
	legacyProfileBadgesKind,
	profileBadgesKind,
	selectProfileBadgesEvent
} from './ProfileBadgesEvent';

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

describe('selectProfileBadgesEvent', () => {
	it('returns the available event', () => {
		const current = event(profileBadgesKind, 1, 'current');
		expect(selectProfileBadgesEvent(current, undefined)).toBe(current);
		expect(selectProfileBadgesEvent(undefined, current)).toBe(current);
		expect(selectProfileBadgesEvent(undefined, undefined)).toBeUndefined();
	});

	it('prefers the event with the newest timestamp across kinds', () => {
		const current = event(profileBadgesKind, 1, 'current');
		const legacy = event(legacyProfileBadgesKind, 2, 'legacy');
		expect(selectProfileBadgesEvent(current, legacy)).toBe(legacy);
	});

	it('prefers kind 10008 across kinds with the same timestamp', () => {
		const current = event(profileBadgesKind, 1, 'z');
		const legacy = event(legacyProfileBadgesKind, 1, 'a');
		expect(selectProfileBadgesEvent(current, legacy)).toBe(current);
		expect(selectProfileBadgesEvent(legacy, current)).toBe(current);
	});

	it('prefers the lowest id within the same kind and timestamp', () => {
		const lower = event(profileBadgesKind, 1, 'a');
		const higher = event(profileBadgesKind, 1, 'b');
		expect(selectProfileBadgesEvent(higher, lower)).toBe(lower);
		expect(selectProfileBadgesEvent(lower, higher)).toBe(lower);
	});
});

describe('isLegacyProfileBadgesEvent', () => {
	it('only accepts kind 30008 with d=profile_badges', () => {
		expect(
			isLegacyProfileBadgesEvent(
				event(legacyProfileBadgesKind, 1, 'legacy', [['d', 'profile_badges']])
			)
		).toBe(true);
		expect(
			isLegacyProfileBadgesEvent(event(legacyProfileBadgesKind, 1, 'set', [['d', 'set']]))
		).toBe(false);
		expect(
			isLegacyProfileBadgesEvent(
				event(profileBadgesKind, 1, 'current', [['d', 'profile_badges']])
			)
		).toBe(false);
	});
});

describe('addAcceptedBadgeTags', () => {
	it('migrates legacy tags without d and appends an ordered badge pair', () => {
		expect(
			addAcceptedBadgeTags(
				[
					['d', 'profile_badges'],
					['a', '30009:issuer:old'],
					['e', 'old-award']
				],
				'30009:issuer:new',
				'new-award',
				'wss://definition.example',
				'wss://award.example'
			)
		).toEqual([
			['a', '30009:issuer:old'],
			['e', 'old-award'],
			['a', '30009:issuer:new', 'wss://definition.example'],
			['e', 'new-award', 'wss://award.example']
		]);
	});

	it('does not add a duplicate definition', () => {
		expect(
			addAcceptedBadgeTags(
				[
					['a', '30009:issuer:badge'],
					['e', 'old-award']
				],
				'30009:issuer:badge',
				'new-award'
			)
		).toBeUndefined();
	});
});
