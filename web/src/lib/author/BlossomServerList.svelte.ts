import type { Event } from 'nostr-tools';
import { getServersFromServerListEvent } from 'blossom-client-sdk/nostr';
import { defaultBlossomServerUrl } from '$lib/Constants';
import {
	getAccountLocalPreferences,
	type AccountLocalPreferences
} from '$lib/preferences/AccountLocalPreferences';

export { defaultBlossomServerUrl } from '$lib/Constants';
let blossomServer = $state<URL | undefined>();

export function getBlossomServer(): URL | undefined {
	return blossomServer;
}

export function resolveBlossomServer(event: Event): URL {
	return (
		getServersFromServerListEvent(event).find((server) => server.protocol === 'https:') ??
		new URL(defaultBlossomServerUrl)
	);
}

function withBlossomServer(
	preferences: AccountLocalPreferences,
	server: URL
): AccountLocalPreferences {
	if (preferences.mediaUploader?.type !== 'blossom') return preferences;
	return {
		...preferences,
		mediaUploader: { type: 'blossom', server: server.href }
	};
}

export function updateBlossomServerList(pubkey: string, event: Event | undefined): void {
	if (event === undefined) {
		blossomServer = undefined;
		return;
	}

	const server = resolveBlossomServer(event);
	blossomServer = server;
	getAccountLocalPreferences(pubkey).update((preferences) =>
		withBlossomServer(preferences, server)
	);
}
