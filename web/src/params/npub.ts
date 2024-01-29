import type { ParamMatcher } from '@sveltejs/kit';
import { match as matchNaddr } from './naddr';
import { match as matchNote } from './note';

const excludePaths = ['robots.txt', 'apple-touch-icon-precomposed.png'];

export const match = ((param) => {
	return (
		/^(npub|nprofile)1[a-z0-9]{6,}$/i.test(param) ||
		(!excludePaths.includes(param) &&
			!matchNote(param) &&
			!matchNaddr(param) &&
			/^(?:[\w-.]+@)?([\w-]\.)+\w{2,}$/.test(param))
	);
}) satisfies ParamMatcher;
