<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { browser } from '$app/environment';
	import { diff } from '$lib/Array';
	import { categories } from '$lib/Constants';
	import type { TimelinePreferences } from '$lib/TimelineFilter';
	import { WebStorage } from '$lib/WebStorage';

	let preferences: TimelinePreferences = browser ? getPreferences() : {};
	let excludeCategories = preferences.excludeCategories ?? [];
	let includeCategories = categories.filter((category) => !excludeCategories.includes(category));

	$: if (browser) {
		console.debug('[timeline filter]', includeCategories);
		preferences.excludeCategories = diff(categories, includeCategories);
		const storage = new WebStorage(localStorage);
		storage.set('preference:timeline-filter:home', JSON.stringify(preferences));
	}

	function getPreferences(): TimelinePreferences {
		const storage = new WebStorage(localStorage);
		const json = storage.get('preference:timeline-filter:home');
		return json !== null ? JSON.parse(json) : {};
	}
</script>

<form on:submit|preventDefault>
	{#each categories as category}
		<div>
			<label>
				<input type="checkbox" value={category} bind:group={includeCategories} />
				<span>{$_(`preferences.timeline_filter.categories.${category}`)}</span>
			</label>
		</div>
	{/each}
</form>
