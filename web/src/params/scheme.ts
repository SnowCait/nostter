import { uriScheme } from '$lib/Constants';
import type { ParamMatcher } from '@sveltejs/kit';

export const match = ((param) => {
	return param.startsWith(encodeURIComponent(`${uriScheme}:`));
}) satisfies ParamMatcher;
