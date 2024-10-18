<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { browser } from '$app/environment';
	import { WebStorage } from '$lib/WebStorage';
	import { imageOptimization } from '$lib/stores/Preference';

	if (browser) {
		imageOptimization.subscribe((value) => {
			const storage = new WebStorage(localStorage);
			storage.set('preference:image-optimization', JSON.stringify(value));
		});
	}
</script>

<label>
	<input type="checkbox" bind:checked={$imageOptimization} />
	<span>{$_('preferences.image_optimization')}</span>
</label>
