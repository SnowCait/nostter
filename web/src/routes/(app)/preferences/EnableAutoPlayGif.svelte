<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { browser } from '$app/environment';
	import { WebStorage } from '$lib/WebStorage';
	import { enableAutoPlayGif } from '$lib/stores/Preference';

	if (browser) {
		enableAutoPlayGif.subscribe((value) => {
			const storage = new WebStorage(localStorage);
			storage.set('preference:autoplay-gif', JSON.stringify(value));
		});
	}
</script>

<label>
	<input type="checkbox" bind:checked={$enableAutoPlayGif} />
	<span>{$_('preferences.autoplay_gif')}</span>
</label>
