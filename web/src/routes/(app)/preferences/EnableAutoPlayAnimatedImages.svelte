<script lang="ts">
	import { browser } from '$app/environment';
	import { WebStorage } from '$lib/WebStorage';
	import { enableAutoPlayAnimatedImages } from '$lib/stores/Preference';
	import { _ } from 'svelte-i18n';

	if (browser) {
		enableAutoPlayAnimatedImages.subscribe((value) => {
			const storage = new WebStorage(localStorage);
			storage.set('preference:autoplay-animated-images', JSON.stringify(value));
		});
	}
</script>

<label>
	<input type="checkbox" bind:checked={$enableAutoPlayAnimatedImages} />
	<span>{$_('preferences.autoplay_animated_images')}</span>
</label>
