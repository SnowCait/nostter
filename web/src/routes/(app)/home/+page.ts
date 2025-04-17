import { _ } from 'svelte-i18n';
import { appName } from '$lib/Constants';
import type { PageLoad } from './$types';
import { get } from 'svelte/store';

export const load: PageLoad = async ({ parent }) => {
	await parent();
	const $_ = get(_);
	return {
		title: `${appName} - ${$_('layout.header.home')}`
	};
};
