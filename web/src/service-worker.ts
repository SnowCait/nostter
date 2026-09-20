/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { receivedShare } from './lib/features/post/application/received-share';
import { saveSharedPost } from './lib/platform/storage/shared-post';

const sw = self as unknown as ServiceWorkerGlobalScope;

sw.addEventListener('install', () => {
	sw.skipWaiting();
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) {
				await caches.delete(key);
			}
			await sw.clients.claim();
		})()
	);
});

sw.addEventListener('fetch', (event) => {
	const request = event.request;
	const url = new URL(request.url);
	if (
		request.method !== 'POST' ||
		url.origin !== sw.location.origin ||
		url.pathname !== '/post' ||
		!request.headers.get('content-type')?.toLowerCase().startsWith('multipart/form-data')
	) {
		return;
	}

	event.respondWith(
		(async () => {
			const destination = new URL('/post', url.origin);
			try {
				const share = receivedShare(await request.formData());
				const id = await saveSharedPost(share);
				destination.searchParams.set('share', id);
			} catch (error) {
				console.error('[share target] Could not receive shared post', error);
			}
			return Response.redirect(destination, 303);
		})()
	);
});
