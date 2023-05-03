import type { ParamMatcher } from '@sveltejs/kit';

export const match = ((param) => {
	return /^(npub|nprofile)1[a-z0-9]+$/.test(param) || /^[\w-.]+@[\w-.]+$/.test(param);
}) satisfies ParamMatcher;
