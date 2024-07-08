import * as Sentry from '@sentry/sveltekit';
import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { prepareStylesSSR } from '@svelteuidev/core';
import { locale } from 'svelte-i18n';
import { get } from 'svelte/store';

Sentry.init({
	dsn: 'https://e2eed08417cadaede983f83fa498b6b8@o4507565086932992.ingest.us.sentry.io/4507565089292288',
	tracesSampleRate: 1
});

const i18n: Handle = async ({ event, resolve }) => {
	const lang = event.request.headers.get('accept-language')?.split(',')[0];
	if (lang) {
		locale.set(lang);
	}
	return resolve(event);
};

const lang: Handle = ({ event, resolve }) => {
	return resolve(event, {
		transformPageChunk: ({ html }) => html.replace('%lang%', get(locale) ?? 'en')
	});
};

export const handle: Handle = sequence(Sentry.sentryHandle(), prepareStylesSSR, i18n, lang);
export const handleError = Sentry.handleErrorWithSentry();
