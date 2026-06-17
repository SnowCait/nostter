import { redirect } from '@sveltejs/kit';
import { browser } from '$app/environment';
import type { LayoutLoad } from './$types';

const protectedPaths = [
	'/home',
	'/notifications',
	'/preferences',
	'/profile',
	'/post',
	'/replay/home'
];

export const load: LayoutLoad = async ({ parent, url }) => {
	const data = await parent();
	if (browser && !data.authenticated && protectedPaths.some((p) => url.pathname.startsWith(p))) {
		redirect(307, '/');
	}
};
