import { writable } from 'svelte/store';
import { categoriesKinds } from './Constants';
import { WebStorage } from './WebStorage';

export const excludeKinds = writable<number[]>([]);

export function storeExcludeKinds(excludeCategories: string[]): void {
	excludeKinds.set(
		Object.entries(categoriesKinds)
			.filter(([category]) => excludeCategories.includes(category))
			.flatMap(([, kinds]) => kinds)
	);
}

export interface TimelineFilter {
	excludeCategories: string[];
}

export const defaultTimelineFilter: TimelineFilter = {
	excludeCategories: []
};

export function getTimelineFilter(): TimelineFilter {
	const storage = new WebStorage(localStorage);
	const json = storage.get('preference:timeline-filter:home');
	return json !== null
		? { ...defaultTimelineFilter, ...JSON.parse(json) }
		: defaultTimelineFilter;
}

export function setTimelineFilter(excludeCategories: string[]): void {
	storeExcludeKinds(excludeCategories);
	const filter = getTimelineFilter();
	filter.excludeCategories = excludeCategories;
	const storage = new WebStorage(localStorage);
	storage.set('preference:timeline-filter:home', JSON.stringify(filter));
}
