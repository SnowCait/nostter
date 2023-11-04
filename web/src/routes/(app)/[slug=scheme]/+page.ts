import { uriScheme } from '$lib/Constants';
import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
	const slug = params.slug.replace(`${uriScheme}:`, '');
	console.log('[uri scheme]', slug);
	throw redirect(301, `/${slug}`);
};
