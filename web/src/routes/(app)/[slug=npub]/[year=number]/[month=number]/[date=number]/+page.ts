import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
	const { slug, year, month, date } = params;
	return {
		slug,
		date: new Date(Number(year), Number(month) - 1, Number(date))
	};
};
