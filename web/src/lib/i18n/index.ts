import { browser } from '$app/environment';
import { init, register } from 'svelte-i18n';
import { WebStorage } from '$lib/WebStorage';

const defaultLocale = 'en';

register('en', () => import('./locales/en.json'));
register('ja', () => import('./locales/ja.json'));

let initialLocale = defaultLocale;
if (browser) {
	const storage = new WebStorage(localStorage);
	const savedLanguage = storage.get('language') as 'system' | 'ja' | 'en' | null;

	if (savedLanguage === 'ja') {
		initialLocale = 'ja';
	} else if (savedLanguage === 'en') {
		initialLocale = 'en';
	} else {
		initialLocale = window.navigator.language;
	}
}

init({
	fallbackLocale: defaultLocale,
	initialLocale
});
