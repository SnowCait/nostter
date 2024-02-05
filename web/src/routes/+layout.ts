import { get } from 'svelte/store';
import { locale, waitLocale } from 'svelte-i18n';
import { browser } from '$app/environment';
import { Login } from '$lib/Login';
import { WebStorage } from '$lib/WebStorage';
import '$lib/i18n';
import { rxNostr } from '$lib/timelines/MainTimeline';
import { defaultRelays, localizedRelays } from '$lib/Constants';
import type { LayoutLoad } from './$types';
import { readRelays, writeRelays } from '../stores/Author';

export const load: LayoutLoad = async () => {
	console.debug('[layout load]');
	let authenticated = false;
	if (browser) {
		rxNostr.setDefaultRelays(defaultRelays);
		locale.set(window.navigator.language);
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
		authenticated = await tryLogin();
	}
	await waitLocale();
	return {
		splash: !browser || authenticated,
		authenticated
	};
};

async function tryLogin(): Promise<boolean> {
	const storage = new WebStorage(localStorage);
	const savedLogin = storage.get('login');
	console.debug('[layout login]', savedLogin);

	if (savedLogin === null) {
		return false;
	}

	const login = new Login();
	if (savedLogin === 'NIP-07') {
		const { waitNostr } = await import('nip07-awaiter');
		const nostr = await waitNostr(10000);
		console.debug('[NIP-07]', nostr);
		if (nostr === undefined) {
			console.error('Browser Extension was not found');
			return false;
		}
		await login.withNip07();
	} else if (savedLogin.startsWith('nsec')) {
		await login.withNsec(savedLogin);
	} else if (savedLogin.startsWith('npub')) {
		await login.withNpub(savedLogin);
	} else {
		console.error('[login logic error]');
		return false;
	}

	return true;
}
