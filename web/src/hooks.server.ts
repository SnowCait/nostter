import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { locale, waitLocale } from 'svelte-i18n';
import { get } from 'svelte/store';

const i18n: Handle = async ({ event, resolve }) => {
	const lang = event.request.headers.get('accept-language')?.split(',')[0];
	if (lang) {
		locale.set(lang);
		await waitLocale(lang);
	}
	return resolve(event);
};

const lang: Handle = ({ event, resolve }) => {
	return resolve(event, {
		transformPageChunk: ({ html }) => html.replace('%lang%', get(locale) ?? 'en')
	});
};

export const handle: Handle = sequence(i18n, lang);
