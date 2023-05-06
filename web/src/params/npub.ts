import type { ParamMatcher } from '@sveltejs/kit';

export const match = ((param) => {
	return /^(npub|nprofile)1[a-z0-9]{6,}$/i.test(param) || /^[\w-.]+@[\w-.]+$/.test(param);
}) satisfies ParamMatcher;
