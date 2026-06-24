import { get } from 'svelte/store';
import { _, locale, waitLocale } from 'svelte-i18n';
import { browser } from '$app/environment';
import { initialize } from '$lib/i18n';
import { rxNostr } from '$lib/timelines/MainTimeline';
import { appName, defaultRelays, localizedRelays } from '$lib/Constants';
import type { LayoutLoad } from './$types';
import { readRelays, writeRelays } from '$lib/stores/Author';

export const load: LayoutLoad = async ({ url }) => {
	await initialize();
	if (browser) {
		rxNostr.setDefaultRelays(defaultRelays);
		if (get(locale)?.startsWith('ja')) {
			rxNostr.addDefaultRelays(localizedRelays.ja);
			readRelays.set(
				Object.entries(rxNostr.getDefaultRelays())
					.filter(([, relay]) => relay.read)
					.map(([, relay]) => relay.url)
			);
			writeRelays.set(
				Object.entries(rxNostr.getDefaultRelays())
					.filter(([, relay]) => relay.write)
					.map(([, relay]) => relay.url)
			);
		}
		console.debug('[default relays]', rxNostr.getDefaultRelays());
	}
	await waitLocale();
	const $_ = get(_);
	return {
		title: appName,
		description: $_('app.description'),
		image: `${url.origin}/logo.png`
	};
};
