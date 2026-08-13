export type SoundCloudEmbed = {
	src: URL;
	title: string;
	height: number;
};

export class SoundCloud {
	private static readonly defaultHeight = 166;
	private static readonly minHeight = 81;
	private static readonly maxHeight = 450;

	static isSoundCloudUrl(url: URL | string): boolean {
		try {
			const parsed = typeof url === 'string' ? new URL(url) : url;
			return (
				parsed.protocol === 'https:' &&
				['soundcloud.com', 'www.soundcloud.com', 'on.soundcloud.com'].includes(
					parsed.hostname
				) &&
				parsed.username === '' &&
				parsed.password === '' &&
				parsed.port === '' &&
				parsed.pathname.split('/').some(Boolean)
			);
		} catch {
			return false;
		}
	}

	static getOEmbedUrl(url: URL | string): URL | undefined {
		if (!this.isSoundCloudUrl(url)) {
			return undefined;
		}

		const parsed = typeof url === 'string' ? new URL(url) : url;
		const oEmbedUrl = new URL('https://soundcloud.com/oembed');
		oEmbedUrl.searchParams.set('format', 'json');
		oEmbedUrl.searchParams.set('url', parsed.href);
		oEmbedUrl.searchParams.set('auto_play', 'false');
		return oEmbedUrl;
	}

	static parseOEmbedResponse(value: unknown): SoundCloudEmbed | undefined {
		if (value === null || typeof value !== 'object' || Array.isArray(value)) {
			return undefined;
		}

		const { version, type, provider_name, provider_url, html, title, height } = value as Record<
			string,
			unknown
		>;
		if (
			version !== 1 ||
			type !== 'rich' ||
			provider_name !== 'SoundCloud' ||
			typeof provider_url !== 'string' ||
			typeof html !== 'string' ||
			html.trim() === '' ||
			(height !== undefined && (typeof height !== 'number' || !Number.isFinite(height)))
		) {
			return undefined;
		}

		if (!URL.canParse(provider_url)) {
			return undefined;
		}
		const providerUrl = new URL(provider_url);
		if (
			providerUrl.protocol !== 'https:' ||
			!['soundcloud.com', 'www.soundcloud.com'].includes(providerUrl.hostname) ||
			providerUrl.username !== '' ||
			providerUrl.password !== '' ||
			providerUrl.port !== ''
		) {
			return undefined;
		}

		const document = new DOMParser().parseFromString(html, 'text/html');
		if (
			document.body.children.length !== 1 ||
			document.body.firstElementChild?.tagName !== 'IFRAME' ||
			document.querySelector('script, object, embed, style') !== null
		) {
			return undefined;
		}

		const src = document.body.firstElementChild.getAttribute('src');
		if (src === null || src.trim() === '') {
			return undefined;
		}

		if (!URL.canParse(src)) {
			return undefined;
		}
		const playerUrl = new URL(src);
		if (
			playerUrl.protocol !== 'https:' ||
			playerUrl.hostname !== 'w.soundcloud.com' ||
			playerUrl.username !== '' ||
			playerUrl.password !== '' ||
			playerUrl.port !== '' ||
			!['/player', '/player/'].includes(playerUrl.pathname)
		) {
			return undefined;
		}

		const safeHeight = Math.min(
			this.maxHeight,
			Math.max(this.minHeight, height ?? this.defaultHeight)
		);
		const safeTitle =
			typeof title === 'string' && title.trim() !== '' ? title : 'SoundCloud player';
		return { src: playerUrl, title: safeTitle, height: safeHeight };
	}

	static async fetchEmbed(
		url: URL | string,
		signal?: AbortSignal
	): Promise<SoundCloudEmbed | undefined> {
		const oEmbedUrl = this.getOEmbedUrl(url);
		if (oEmbedUrl === undefined) {
			return undefined;
		}

		try {
			const response = await fetch(oEmbedUrl, { signal });
			return response.ok ? this.parseOEmbedResponse(await response.json()) : undefined;
		} catch {
			return undefined;
		}
	}
}
