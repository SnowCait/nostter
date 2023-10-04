import { locale, waitLocale } from 'svelte-i18n';
import { browser } from '$app/environment';
import { Login } from '$lib/Login';
import { WebStorage } from '$lib/WebStorage';
import '$lib/i18n';

export const load = async () => {
	console.log('[layout load]');
	if (browser) {
		locale.set(window.navigator.language);
		await tryLogin();
	}
	await waitLocale();
};

async function tryLogin(): Promise<boolean> {
	const storage = new WebStorage(localStorage);
	const savedLogin = storage.get('login');
	console.log('[layout login]', savedLogin);

	if (savedLogin === null) {
		return false;
	}

	const { waitNostr } = await import('nip07-awaiter');
	const login = new Login();
	if (savedLogin === 'NIP-07') {
		const nostr = await waitNostr(10000);
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
