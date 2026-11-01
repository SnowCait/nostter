export function isAllowedLinkScheme(url: URL | null): boolean {
	return (
		url !== null &&
		url.protocol !== 'javascript:' &&
		url.protocol !== 'data:' &&
		url.protocol !== 'vbscript:'
	);
}

export function isHttpUrl(url: URL): boolean {
	return url.protocol === 'https:' || url.protocol === 'http:';
}

export function isSimplexSmpUrl(url: URL): boolean {
	return /^smp\d+\.simplex\.im$/s.test(url.hostname);
}
