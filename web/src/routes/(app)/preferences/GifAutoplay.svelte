<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { browser } from '$app/environment';
	import { WebStorage } from '$lib/WebStorage';
	import { gifAutoplay } from '$lib/stores/Preference';

	if (browser) {
		gifAutoplay.subscribe((value) => {
			const storage = new WebStorage(localStorage);
			storage.set('preference:gif-autoplay', JSON.stringify(value));
		});
	}
</script>

<label>
	<input type="checkbox" bind:checked={$gifAutoplay} />
	<span>{$_('preferences.gif_autoplay')}</span>
</label>
