export function isHttpUrl(url: URL): boolean {
	return url.protocol === 'https:' || url.protocol === 'http:';
}

export function isSimplexSmpUrl(url: URL): boolean {
	return /^smp\d+\.simplex\.im$/s.test(url.hostname);
}

export function isYouTubeUrl(url: URL): boolean {
	return (
		((url.hostname === 'youtu.be' || /^(.+\.)*youtube\.com$/s.test(url.hostname)) &&
			!url.pathname.startsWith('/@')) ||
		(url.hostname === 'www.youtube-nocookie.com' && url.pathname.startsWith('/embed/'))
	);
}
