import { speeds } from '$lib/timelines/ReplayHomeTimeline';
import type { PageLoad } from './$types';

export const ssr = false;

function parseSince(value: string | null): Date | null {
	if (value === null) {
		return null;
	}

	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}

function parseSpeed(value: string | null): number {
	if (value === null) {
		return speeds[0];
	}

	const speed = Number(value);
	return 0 < speed && speed <= 10 ? speed : speeds[0];
}

export const load: PageLoad<{
	since: Date | null;
	speed: number;
}> = ({ url }) => {
	return {
		since: parseSince(url.searchParams.get('since')),
		speed: parseSpeed(url.searchParams.get('speed'))
	};
};
