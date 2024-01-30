import type { ParamMatcher } from '@sveltejs/kit';

export const match = ((param) => {
	return !Number.isNaN(param);
}) satisfies ParamMatcher;
