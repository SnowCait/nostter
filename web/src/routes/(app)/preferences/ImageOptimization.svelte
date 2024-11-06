<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { browser } from '$app/environment';
	import { WebStorage } from '$lib/WebStorage';
	import { imageOptimization } from '$lib/stores/Preference';
	import { imageOptimizerServers } from '$lib/Constants';
	import { NativeSelect } from '@svelteuidev/core';

	if (browser) {
		imageOptimization.subscribe((value) => {
			const storage = new WebStorage(localStorage);
			storage.set('preference:image-optimization', value);
		});
	}
</script>

<div>{$_('preferences.image_optimization')}</div>
<NativeSelect
	data={[
		{ label: $_('preferences.image_optimization_none'), value: '' },
		...imageOptimizerServers.map((server) => ({
			label: server,
			value: server
		}))
	]}
	bind:value={$imageOptimization}
/>
