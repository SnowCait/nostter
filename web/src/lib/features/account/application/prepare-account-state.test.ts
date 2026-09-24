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
	it('lets kind 10002 relay values override legacy contacts relays', () => {
		const state = prepareAccountState(
			accountEvents([
				event(3, JSON.stringify({ 'wss://legacy.example': { read: true, write: false } }), [
					['p', 'followee']
				]),
				event(10002, '', [['r', 'wss://current.example', 'write']])
			])
		);

		expect(state.contactsTags).toEqual([['p', 'followee']]);
		expect(state.relayUpdates).toEqual([
			{
				source: 'contacts',
				readRelays: ['wss://legacy.example'],
				writeRelays: []
			},
			{
				source: 'relay-list',
				readRelays: [],
				writeRelays: ['wss://current.example']
			}
		]);
	});

	it('preserves preference update versus unchanged semantics', () => {
		const missing = prepareAccountState(accountEvents());
		expect(missing.preferences).toEqual({ type: 'unchanged' });

		const legacy = event(30078, '✨', [['d', 'nostter-reaction-emoji']]);
		const fallback = prepareAccountState(accountEvents([], [legacy]));
		expect(fallback.preferences).toEqual({
			type: 'publish',
			value: Object.assign(new Preferences('{}'), { reactionEmoji: { content: '✨' } })
		});
		expect(fallback.legacyReactionEmojiEvent).toBe(legacy);

		const current = event(30078, JSON.stringify({ reactionEmoji: { content: '♥' } }), [
			['d', 'nostter-preferences']
		]);
		const currentState = prepareAccountState(accountEvents([], [legacy, current]));
		expect(currentState.preferences).toMatchObject({
			type: 'publish',
			value: { reactionEmoji: { content: '♥' } }
		});
		expect(currentState.legacyReactionEmojiEvent).toBeUndefined();
	});

	it('prefers current last-read state and leaves it unchanged when both events are missing', () => {
		const current = event(30078, '', [['d', 'nostter-read']], 20);
		const legacy = event(30000, '', [['d', 'notifications/lastOpened']], 10);
		const state = prepareAccountState(accountEvents([], [current, legacy]));
		expect(state.lastReadAt).toEqual({ type: 'publish', value: 20 });

		expect(prepareAccountState(accountEvents()).lastReadAt).toEqual({ type: 'unchanged' });
	});

	it('distinguishes missing metadata from invalid metadata', () => {
		const missing = prepareAccountState(accountEvents());
		expect(missing.metadataEvent).toEqual({ type: 'unchanged' });
		expect(missing.authorProfile).toEqual({ type: 'publish', value: {} });

		const invalid = event(0, '{');
		const state = prepareAccountState(accountEvents([invalid]));
		expect(state.metadataEvent).toEqual({ type: 'publish', value: invalid });
		expect(state.authorProfile).toEqual({ type: 'unchanged' });
		expect(state.invalidMetadata?.event).toBe(invalid);
		expect(state.invalidMetadata?.error).toBeInstanceOf(SyntaxError);
	});
});
