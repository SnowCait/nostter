import type { ParamMatcher } from '@sveltejs/kit';

export const match = ((param) => {
	return /^(npub|nprofile)1[a-z0-9]+$/.test(param);
}) satisfies ParamMatcher;
