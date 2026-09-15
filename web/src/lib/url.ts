export function isHttpUrl(url: URL): boolean {
	return url.protocol === 'https:' || url.protocol === 'http:';
}

export function isSimplexSmpUrl(url: URL): boolean {
	return /^smp\d+\.simplex\.im$/s.test(url.hostname);
}
