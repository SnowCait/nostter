import { locale, waitLocale } from 'svelte-i18n';
import { browser } from '$app/environment';
import { Login } from '$lib/Login';
import { WebStorage } from '$lib/WebStorage';
import '$lib/i18n';
import { rxNostr } from '$lib/timelines/MainTimeline';
import { defaultRelays } from '$lib/Constants';

export const load = async () => {
	console.log('[layout load]');
	let authenticated = false;
	if (browser) {
		locale.set(window.navigator.language);
		authenticated = await tryLogin();
		if (!authenticated) {
			rxNostr.setDefaultRelays(defaultRelays);
		}
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
	console.log('[layout login]', savedLogin);

	if (savedLogin === null) {
		return false;
	}

	const login = new Login();
	if (savedLogin === 'NIP-07') {
		const { waitNostr } = await import('nip07-awaiter');
		const nostr = await waitNostr(10000);
		console.log('[NIP-07]', nostr);
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
