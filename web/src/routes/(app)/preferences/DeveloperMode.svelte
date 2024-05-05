<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { browser } from '$app/environment';
	import { WebStorage } from '$lib/WebStorage';
	import { developerMode } from '$lib/stores/Preference';

	if (browser) {
		developerMode.subscribe((value) => {
			const storage = new WebStorage(localStorage);
			storage.set('preference:developer-mode', JSON.stringify(value));
		});
	}
</script>

<label>
	<input type="checkbox" bind:checked={$developerMode} />
	<span>{$_('preferences.developer_mode')}</span>
</label>
