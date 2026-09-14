export function isHttpUrl(url: URL): boolean {
	return url.protocol === 'https:' || url.protocol === 'http:';
}

export function isImageResourceUrl(url: URL): boolean {
	if (isHttpUrl(url)) {
		return true;
	}
	if (url.protocol !== 'data:') {
		return false;
	}

	const commaIndex = url.pathname.indexOf(',');
	if (commaIndex === -1) {
		return false;
	}

	const mediaType = url.pathname.slice(0, commaIndex).split(';', 1)[0].toLowerCase();
	return mediaType.startsWith('image/') && mediaType.length > 'image/'.length;
}

export function isAudioResourceUrl(url: URL): boolean {
	return isHttpUrl(url);
}

export function isSimplexSmpUrl(url: URL): boolean {
	return /^smp\d+\.simplex\.im$/s.test(url.hostname);
}
