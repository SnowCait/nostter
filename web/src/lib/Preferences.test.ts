import { describe, expect, it } from 'vitest';
import { Preferences } from './Preferences';

describe('Preferences', () => {
	it('ignores the retired muteAutomatically preference', () => {
		const preferences = new Preferences(
			JSON.stringify({
				reactionEmoji: { content: '🙂' },
				muteAutomatically: true
			})
		);

		expect(preferences.reactionEmoji).toEqual({ content: '🙂' });
		expect('muteAutomatically' in preferences).toBe(false);
		expect(JSON.parse(preferences.toJson())).toEqual({
			reactionEmoji: { content: '🙂' },
			media: {}
		});
	});
});
