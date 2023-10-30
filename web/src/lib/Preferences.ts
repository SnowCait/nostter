import { writable } from 'svelte/store';
import type { Emoji } from './Emoji';

export class Preferences {
	public reactionEmoji: Emoji = { content: '+' };
	constructor(content: string) {
		try {
			const preferences = JSON.parse(content);
			if (preferences.reactionEmoji !== undefined) {
				this.reactionEmoji = preferences.reactionEmoji;
			}
		} catch (error) {
			console.error('[invalid preferences]', content);
		}
	}

	public toJson(): string {
		return JSON.stringify({
			reactionEmoji: this.reactionEmoji
		});
	}
}

export const preferencesStore = writable(new Preferences('{}'));
preferencesStore.subscribe((value) => {
	console.log('[preferences]', value);
});
