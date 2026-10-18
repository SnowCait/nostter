import type { Event } from 'nostr-tools';
import { describe, expect, it } from 'vitest';
import { Preferences } from '$lib/Preferences';
import { prepareAccountState } from './prepare-account-state';

function event(kind: number, content = '', tags: string[][] = [], created_at = 1): Event {
	return {
		id: 'e'.repeat(64),
		pubkey: 'p'.repeat(64),
		created_at,
		kind,
		tags,
		content,
		sig: 's'.repeat(128)
	} as Event;
}

function accountEvents(
	replaceableEvents: Event[] = [],
	parameterizedReplaceableEvents: Event[] = []
) {
	return {
		replaceableEvents: new Map(replaceableEvents.map((value) => [value.kind, value])),
		parameterizedReplaceableEvents: new Map(
			parameterizedReplaceableEvents.map((value) => [
				`${value.kind}:${value.tags.find(([name]) => name === 'd')?.[1] ?? ''}`,
				value
			])
		)
	};
}

describe('prepareAccountState', () => {
	it('retains the fetched kind 10001 event for pinned notes initialization', () => {
		const pins = event(10001, 'encrypted pins', [['e', 'note']]);
		expect(prepareAccountState(accountEvents([pins])).pinnedNotesEvent).toBe(pins);
	});
	it('retains kind 3 contact tags', () => {
		const state = prepareAccountState(accountEvents([event(3, '', [['p', 'followee']])]));
		expect(state.contactsTags).toEqual([['p', 'followee']]);
	});

	it('uses default preferences when current and legacy events are missing', () => {
		const missing = prepareAccountState(accountEvents());
		expect(missing.preferences).toEqual(new Preferences('{}'));

		const legacy = event(30078, '✨', [['d', 'nostter-reaction-emoji']]);
		const fallback = prepareAccountState(accountEvents([], [legacy]));
		expect(fallback.preferences).toEqual(
			Object.assign(new Preferences('{}'), { reactionEmoji: { content: '✨' } })
		);
		expect(fallback.legacyReactionEmojiEvent).toBe(legacy);

		const current = event(30078, JSON.stringify({ reactionEmoji: { content: '♥' } }), [
			['d', 'nostter-preferences']
		]);
		const currentState = prepareAccountState(accountEvents([], [legacy, current]));
		expect(currentState.preferences).toMatchObject({ reactionEmoji: { content: '♥' } });
		expect(currentState.legacyReactionEmojiEvent).toBeUndefined();
	});

	it('prefers current then legacy last-read state and defaults to zero', () => {
		const current = event(30078, '', [['d', 'nostter-read']], 20);
		const legacy = event(30000, '', [['d', 'notifications/lastOpened']], 10);
		const state = prepareAccountState(accountEvents([], [current, legacy]));
		expect(state.lastReadAt).toBe(20);

		expect(prepareAccountState(accountEvents([], [legacy])).lastReadAt).toBe(10);
		expect(prepareAccountState(accountEvents()).lastReadAt).toBe(0);
	});

	it('prepares empty metadata/profile values for missing and invalid metadata', () => {
		const missing = prepareAccountState(accountEvents());
		expect(missing.metadataEvent).toBeUndefined();
		expect(missing.authorProfile).toEqual({});

		const invalid = event(0, '{');
		const state = prepareAccountState(accountEvents([invalid]));
		expect(state.metadataEvent).toBe(invalid);
		expect(state.authorProfile).toEqual({});
		expect(state.invalidMetadata?.event).toBe(invalid);
		expect(state.invalidMetadata?.error).toBeInstanceOf(SyntaxError);
	});
});
