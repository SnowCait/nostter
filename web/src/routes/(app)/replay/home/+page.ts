import type { PageLoad } from './$types';

export const load: PageLoad<{
	since: Date | null;
}> = async ({ url }) => {
	const since = url.searchParams.get('since');
	console.log('[replay page load]', since);
	return {
		since: since === null ? null : new Date(since)
	};
};
