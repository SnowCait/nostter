import { speeds } from '$lib/timelines/ReplayHomeTimeline';
import type { PageLoad } from './$types';

export const load: PageLoad<{
	since: Date | null;
	speed: number;
}> = async ({ url }) => {
	const since = url.searchParams.get('since');
	const speed = Number(url.searchParams.get('speed'));
	console.log('[replay page load]', since);
	return {
		since: since === null ? null : new Date(since),
		speed: 0 < speed && speed <= 10 ? speed : speeds[0]
	};
};
