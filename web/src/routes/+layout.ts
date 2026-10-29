import { defaultRelaySettings } from '$lib/relay-client';
import { get } from 'svelte/store';
import { _, locale, waitLocale } from 'svelte-i18n';
import { browser } from '$app/environment';
import { initialize } from '$lib/i18n';
import { appName } from '$lib/app';
import { applicationRelays } from '$lib/nostr/relay/application-relays';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ url }) => {
	await initialize();
	if (browser) {
		defaultRelaySettings.set(applicationRelays(get(locale)));
		console.debug('[default relays]', defaultRelaySettings.get());
	}
	await waitLocale();
	const $_ = get(_);
	return {
		title: appName,
		description: $_('app.description'),
		image: `${url.origin}/logo.png`
	};
};
