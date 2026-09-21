export function isYouTubeUrl(url: URL): boolean {
	const isYouTubeHost =
		url.hostname === 'youtu.be' ||
		url.hostname === 'youtube.com' ||
		url.hostname.endsWith('.youtube.com');

	return (
		(isYouTubeHost && !url.pathname.startsWith('/@')) ||
		(url.hostname === 'www.youtube-nocookie.com' && url.pathname.startsWith('/embed/'))
	);
}
