export class Spotify {
	private static readonly types = new Set([
		'album',
		'artist',
		'episode',
		'playlist',
		'show',
		'track'
	]);

	static getEmbedUrl(url: URL | string): URL | undefined {
		const parsed = typeof url === 'string' ? new URL(url) : url;
		if (parsed.protocol !== 'https:' || parsed.hostname !== 'open.spotify.com') {
			return undefined;
		}

		const parts = parsed.pathname.split('/').filter(Boolean);
		const [first, second, third] = parts;
		const [type, id] =
			first === 'embed'
				? [second, third]
				: first?.startsWith('intl-')
					? [second, third]
					: [first, second];

		if (type === undefined || id === undefined || !this.types.has(type)) {
			return undefined;
		}

		const embedUrl = new URL(`https://open.spotify.com/embed/${type}/${id}`);
		embedUrl.search = parsed.search;
		return embedUrl;
	}

	static isSpotifyUrl(url: URL | string): boolean {
		return this.getEmbedUrl(url) !== undefined;
	}
}
