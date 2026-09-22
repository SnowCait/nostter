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

interface YouTubeVideo {
	id: string | undefined;
	short: boolean;
}

function getYouTubeVideo(link: URL): YouTubeVideo {
	if (link.hostname === 'youtu.be') {
		return { id: link.pathname.split('/')[1], short: false };
	}

	const [, pathType, pathVideoId] = link.pathname.split('/');
	if (pathType === 'embed' || pathType === 'live') {
		return { id: pathVideoId, short: false };
	}

	const videoId = link.searchParams.get('v');
	if (videoId !== null) {
		return { id: videoId, short: false };
	}

	if (pathType === 'shorts') {
		return { id: pathVideoId, short: true };
	}

	return { id: undefined, short: false };
}

function parseStartTime(value: string | null): number | undefined {
	if (value === null) return undefined;

	if (/^\d+$/u.test(value)) {
		const seconds = Number(value);
		return Number.isSafeInteger(seconds) && seconds > 0 ? seconds : undefined;
	}

	const match = value.match(/^(?:(?<hours>\d+)h)?(?:(?<minutes>\d+)m)?(?:(?<seconds>\d+)s)?$/u);
	if (match === null || match[0] === '') return undefined;

	const hours = Number(match.groups?.hours ?? 0);
	const minutes = Number(match.groups?.minutes ?? 0);
	const seconds = Number(match.groups?.seconds ?? 0);
	const totalSeconds = hours * 60 * 60 + minutes * 60 + seconds;

	return Number.isSafeInteger(totalSeconds) && totalSeconds > 0 ? totalSeconds : undefined;
}

export function getYouTubeEmbed(
	link: URL,
	origin: string
): { src: URL; short: boolean } | undefined {
	if (!isYouTubeUrl(link)) return undefined;

	const video = getYouTubeVideo(link);
	if (video.id === undefined || video.id === '') return undefined;

	const host =
		link.hostname === 'www.youtube-nocookie.com'
			? 'www.youtube-nocookie.com'
			: 'www.youtube.com';
	const src = new URL(`https://${host}/embed/${video.id}`);
	src.searchParams.set('origin', origin);

	const startTime = parseStartTime(link.searchParams.get('t'));
	if (startTime !== undefined) {
		src.searchParams.set('start', startTime.toString());
	}

	return { src, short: video.short };
}
