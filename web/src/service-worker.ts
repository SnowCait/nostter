/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

console.debug('[service worker]');

const CACHE = `cache-${version}`;

const ASSETS = [...build, ...files];

sw.addEventListener('install', (e) => {
	console.debug('[service worker install]', CACHE, ASSETS);

	async function addFilesToCache() {
		const cache = await caches.open(CACHE);
		await cache.addAll(ASSETS);
	}

	e.waitUntil(addFilesToCache());
});

sw.addEventListener('activate', (e) => {
	console.debug('[service worker activate]', CACHE);

	async function deleteOldCaches() {
		for (const key of await caches.keys()) {
			if (key !== CACHE) {
				console.debug('[service worker delete]', key);
				await caches.delete(key);
			}
		}
	}

	e.waitUntil(deleteOldCaches());
});

sw.addEventListener('fetch', (e) => {
	const url = new URL(e.request.url);
	if (e.request.method !== 'GET' || url.origin !== sw.origin) {
		return;
	}

	async function respond() {
		const cache = await caches.open(CACHE);

		if (ASSETS.includes(url.pathname)) {
			const response = await cache.match(url.pathname);

			if (response) {
				console.debug('[service worker cache]', url.pathname);
				return response;
			}
		}

		return await fetch(e.request);
	}

	e.respondWith(respond());
});
