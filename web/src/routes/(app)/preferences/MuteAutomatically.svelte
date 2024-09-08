<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { preferencesStore, savePreferences } from '$lib/Preferences';

	let enable = $preferencesStore.muteAutomatically;

	async function changed(): Promise<void> {
		console.log('[preferences mute automatically changed]', enable);
		$preferencesStore.muteAutomatically = enable;
		await savePreferences();
	}
</script>

<label>
	<input type="checkbox" bind:checked={enable} on:change={changed} />
	<span>{$_('preferences.mute.automatically')}</span>
</label>
