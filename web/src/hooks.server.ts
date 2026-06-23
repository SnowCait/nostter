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

const cspDirectives: Record<string, string[]> = {
	'default-src': ["'self'"],
	'script-src': [
		"'self'",
		"'unsafe-inline'",
		"'wasm-unsafe-eval'",
		'https://platform.twitter.com',
		'https://www.googletagmanager.com',
		'https://embed.nicovideo.jp'
	],
	'style-src': ["'self'", "'unsafe-inline'"],
	'img-src': ["'self'", 'data:', 'blob:', 'https:'],
	'media-src': ["'self'", 'blob:', 'https:'],
	'font-src': ["'self'"],
	'connect-src': ["'self'", 'https:', 'wss:', 'ws:'],
	'frame-src': [
		"'self'",
		'https://www.youtube.com',
		'https://www.youtube-nocookie.com',
		'https://open.spotify.com',
		'https://embed.nicovideo.jp',
		'https://platform.twitter.com',
		'https://syndication.twitter.com'
	],
	'worker-src': ["'self'", 'blob:'],
	'object-src': ["'none'"],
	'base-uri': ["'self'"],
	'frame-ancestors': ["'self'", 'https://deck.nostter.app'],
	'form-action': ["'self'"],
	'manifest-src': ["'self'"]
};

const contentSecurityPolicy = Object.entries(cspDirectives)
	.map(([directive, values]) => `${directive} ${values.join(' ')}`)
	.join('; ');

const csp: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	response.headers.set('Content-Security-Policy', contentSecurityPolicy);
	return response;
};

export const handle: Handle = sequence(i18n, lang, csp);
