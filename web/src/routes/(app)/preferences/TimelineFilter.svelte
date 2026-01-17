<script lang="ts">
	import { run, createBubbler, preventDefault } from 'svelte/legacy';

	const bubble = createBubbler();
	import { _ } from 'svelte-i18n';
	import { browser } from '$app/environment';
	import { diff } from '$lib/Array';
	import { categories } from '$lib/Constants';
	import {
		defaultTimelineFilter,
		getTimelineFilter,
		setTimelineFilter
	} from '$lib/TimelineFilter';

	let filter = browser ? getTimelineFilter() : defaultTimelineFilter;
	let excludeCategories = filter.excludeCategories;
	let includeCategories = $state(
		categories.filter((category) => !excludeCategories.includes(category))
	);

	run(() => {
		if (browser) {
			setTimelineFilter(diff(categories, includeCategories));
		}
	});
</script>

<form onsubmit={preventDefault(bubble('submit'))}>
	{#each categories as category}
		<div>
			<label>
				<input type="checkbox" value={category} bind:group={includeCategories} />
				<span>{$_(`preferences.timeline_filter.categories.${category}`)}</span>
			</label>
		</div>
	{/each}
</form>
