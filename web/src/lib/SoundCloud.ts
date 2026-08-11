export type SoundCloudEmbed = {
	src: URL;
	title: string;
	height: number;
};

export class SoundCloud {
	static isSoundCloudUrl(url: URL | string): boolean {
		try {
			const parsed = typeof url === 'string' ? new URL(url) : url;
			return (
				parsed.protocol === 'https:' &&
				['soundcloud.com', 'www.soundcloud.com'].includes(parsed.hostname) &&
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
		return oEmbedUrl;
	}

	static parseOEmbedResponse(value: unknown): SoundCloudEmbed | undefined {
		if (value === null || typeof value !== 'object') {
			return undefined;
		}

		const { html, title, height } = value as Record<string, unknown>;
		if (
			typeof html !== 'string' ||
			typeof title !== 'string' ||
			typeof height !== 'number' ||
			!Number.isFinite(height) ||
			height <= 0
		) {
			return undefined;
		}

		const src = new DOMParser()
			.parseFromString(html, 'text/html')
			.querySelector('iframe')
			?.getAttribute('src');
		if (src === null || src === undefined || !URL.canParse(src)) {
			return undefined;
		}

		const playerUrl = new URL(src);
		if (
			playerUrl.protocol !== 'https:' ||
			playerUrl.hostname !== 'w.soundcloud.com' ||
			!['/player', '/player/'].includes(playerUrl.pathname)
		) {
			return undefined;
		}

		return { src: playerUrl, title, height };
	}

	static async fetchEmbed(url: URL | string): Promise<SoundCloudEmbed | undefined> {
		const oEmbedUrl = this.getOEmbedUrl(url);
		if (oEmbedUrl === undefined) {
			return undefined;
		}

		try {
			const response = await fetch(oEmbedUrl);
			return response.ok ? this.parseOEmbedResponse(await response.json()) : undefined;
		} catch {
			return undefined;
		}
	}
}
