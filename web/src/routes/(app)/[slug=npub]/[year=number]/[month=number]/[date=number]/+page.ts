import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
	const { year, month, date } = params;
	return {
		date: new Date(Number(year), Number(month) - 1, Number(date))
	};
};
