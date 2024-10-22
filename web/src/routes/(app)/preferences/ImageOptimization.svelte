<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { browser } from '$app/environment';
	import { WebStorage } from '$lib/WebStorage';
	import { imageOptimization, imageOptimizationEndpoint } from '$lib/stores/Preference';
	import { imageOptimizerServers } from '$lib/Constants';
	import { NativeSelect } from '@svelteuidev/core';

	if (browser) {
		imageOptimization.subscribe((value) => {
			const storage = new WebStorage(localStorage);
			storage.set('preference:image-optimization', JSON.stringify(value));
		});
		imageOptimizationEndpoint.subscribe((value) => {
			const storage = new WebStorage(localStorage);
			console.log(value);
			storage.set('preference:image-optimization:endpoint', value);
		});
	}
</script>

<label>
	<input type="checkbox" bind:checked={$imageOptimization} />
	<span>{$_('preferences.image_optimization')}</span>
	{#if $imageOptimization}
		<NativeSelect
			data={imageOptimizerServers.map((server) => {
				return {
					label: server.name,
					value: server.endpoint
				};
			})}
			bind:value={$imageOptimizationEndpoint}
		/>
	{/if}
</label>
