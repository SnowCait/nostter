import { get, writable } from 'svelte/store';
import { now } from 'rx-nostr';
import { fileStorageServers } from './Constants';
import type { Emoji } from './Emoji';
import { Signer } from './Signer';
import { rxNostr } from './timelines/MainTimeline';

let saving = false;
let unsaved = false;

export class Preferences {
	public reactionEmoji: Emoji = { content: '+' };
	public mediaUploader: string | undefined;
	public muteAutomatically = false;

	constructor(content: string) {
		try {
			const preferences = JSON.parse(content);
			if (preferences.reactionEmoji !== undefined) {
				this.reactionEmoji = preferences.reactionEmoji;
			}
			if (preferences.media?.uploader !== undefined) {
				const server = preferences.media.uploader as string;
				if (fileStorageServers.includes(server)) {
					this.mediaUploader = server;
				}
			}
			if (preferences.muteAutomatically !== undefined) {
				this.muteAutomatically = preferences.muteAutomatically;
			}
		} catch (error) {
			console.error('[invalid preferences]', content, error);
		}
	}

	public toJson(): string {
		return JSON.stringify({
			reactionEmoji: this.reactionEmoji,
			media: {
				uploader: this.mediaUploader
			},
			muteAutomatically: this.muteAutomatically
		});
	}
}

export const preferencesStore = writable(new Preferences('{}'));
preferencesStore.subscribe((value) => {
	console.log('[preferences]', value);
});

export async function savePreferences(): Promise<void> {
	console.debug('[preferences try save]', saving, unsaved);
	if (saving) {
		unsaved = true;
		return;
	}

	saving = true;
	unsaved = false;

	const event = await Signer.signEvent({
		kind: 30078,
		content: get(preferencesStore).toJson(),
		tags: [['d', 'nostter-preferences']],
		created_at: now()
	});
	console.debug('[preferences save]', event);

	const complete = () => {
		console.log('[preferences saved]', event);
		saving = false;
		if (unsaved) {
			savePreferences();
		}
	};
	rxNostr.send(event).subscribe({
		next: ({ from, message }) => {
			console.debug('[rx-nostr preferences send]', from, message);
		},
		complete: () => {
			console.debug('[rx-nostr preferences complete]');
			complete();
		},
		error: (error) => {
			console.warn('[rx-nostr preferences error]', error);
			complete();
		}
	});
}
