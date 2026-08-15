import type { Event } from 'nostr-tools';
import { blossomServerListEvent } from '$lib/stores/Author';
import { resolveBlossomServer } from '$lib/media/Blossom';
import {
	getAccountLocalPreferences,
	type AccountLocalPreferences
} from '$lib/preferences/AccountLocalPreferences';

export function withBlossomServer(
	preferences: AccountLocalPreferences,
	event: Event
): AccountLocalPreferences {
	if (preferences.mediaUploader?.type !== 'blossom') return preferences;
	return {
		...preferences,
		mediaUploader: { type: 'blossom', server: resolveBlossomServer(event).href }
	};
}

export function updateBlossomServerList(pubkey: string, event: Event | undefined): void {
	blossomServerListEvent.set(event);
	if (event === undefined) return;

	getAccountLocalPreferences(pubkey).update((preferences) =>
		withBlossomServer(preferences, event)
	);
}
