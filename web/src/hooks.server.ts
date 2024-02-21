import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { prepareStylesSSR } from '@svelteuidev/core';
import { locale } from 'svelte-i18n';

const i18n: Handle = async ({ event, resolve }) => {
	const lang = event.request.headers.get('accept-language')?.split(',')[0];
	if (lang) {
		locale.set(lang);
	}
	return resolve(event);
};

export const handle: Handle = sequence(prepareStylesSSR, i18n);
