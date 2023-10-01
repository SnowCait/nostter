<script lang="ts">
	import { browser } from '$app/environment';
	import { WebStorage } from '$lib/WebStorage';
	import { theme } from '../../stores/Preference';

	if (browser) {
		theme.subscribe((v) => {
			console.log('[theme]', v);
			const storage = new WebStorage(localStorage);
			storage.set('theme', v);
		});
	}
</script>

<select bind:value={$theme}>
	<option value="system">System</option>
	<option value="light">Light</option>
	<option value="dark">Dark</option>
</select>
