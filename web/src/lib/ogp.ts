import { httpProxy } from '$lib/Constants';

export type Ogp = {
	title?: string;
	image?: string;
};

export async function fetchOgp(url: URL): Promise<Ogp | undefined> {
	return (await fetchOgpViaProxy(url)) ?? (await fetchOgpDirect(url));
}

export async function fetchOgpViaProxy(url: URL): Promise<Ogp | undefined> {
	console.debug('[ogp proxy]', url.href);

	let response: Response;
	try {
		response = await fetch(`${httpProxy}/?url=${encodeURIComponent(url.href)}`, {
			headers: { Accept: 'application/json' }
		});
	} catch (error) {
		console.debug('[ogp proxy error]', url.href, error);
		return undefined;
	}

	const contentType = response.headers.get('Content-Type');
	if (!response.ok || !contentType?.includes('application/json')) {
		console.debug('[ogp proxy error]', url.href, response.status, contentType);
		return undefined;
	}

	const ogp: Record<string, string> = await response.json();
	console.debug('[ogp proxy]', url.href, ogp);
	return {
		title: ogp['og:title'] ?? ogp['title'],
		image: ogp['og:image']
	};
}

export async function fetchOgpDirect(url: URL): Promise<Ogp | undefined> {
	console.debug('[ogp direct]', url.href);

	let response: Response;
	try {
		response = await fetch(url);
	} catch (error) {
		console.debug('[ogp direct error]', url.href, error);
		return undefined;
	}

	const contentType = response.headers.get('Content-Type');
	if (!response.ok || !contentType?.includes('text/html')) {
		console.debug('[ogp direct error]', url.href, response.status, contentType);
		return undefined;
	}

	const html = await response.text();

	// Workaround for Chromium bug
	// <meta name="text-scale" content="scale" /> cause STATUS_ACCESS_VIOLATION
	if (html.includes('text-scale')) {
		console.debug('[ogp direct workaround]', url.href);
		return undefined;
	}

	return parseOgp(html, contentType);
}

export function parseOgp(html: string, contentType: string): Ogp | undefined {
	const dom = new DOMParser().parseFromString(html, 'text/html');
	const metaTags = [...dom.head.children].filter((element) => element.tagName === 'META');

	if (
		!/charset=utf-8/i.test(contentType) &&
		!metaTags.some((element) => element.getAttribute('charset')?.toLowerCase() === 'utf-8')
	) {
		console.debug(
			'[ogp charset is not utf-8]',
			metaTags.find((element) => element.getAttribute('charset') !== null)
		);
		return undefined;
	}

	const ogp = Object.fromEntries(
		metaTags
			.filter(
				(element) =>
					element.getAttribute('property')?.startsWith('og:') &&
					element.getAttribute('content')
			)
			.map((element) => [element.getAttribute('property')!, element.getAttribute('content')!])
	);
	console.debug('[ogp direct]', dom.title, ogp);
	return {
		title: ogp['og:title'] ?? dom.title,
		image: ogp['og:image']
	};
}
