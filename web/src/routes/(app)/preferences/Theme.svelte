<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { writable, type Writable } from 'svelte/store';
	import { browser } from '$app/environment';
	import { applyTheme, type Theme } from '$lib/Theme';
	import { WebStorage } from '$lib/WebStorage';

	let theme: Writable<Theme>;
	if (browser) {
		const storage = new WebStorage(localStorage);
		theme = writable((storage.get('theme') as Theme | null) ?? 'system');
		theme.subscribe((v) => {
			console.log('[theme]', v);
			storage.set('theme', v);
			applyTheme(v);
		});
	}
</script>

<div>
	<label for="theme-select">{$_('preferences.theme.theme')}:</label>
	<select bind:value={$theme} id="theme-select">
		<option value="system">{$_('preferences.theme.system')}</option>
		<option value="light">{$_('preferences.theme.light')}</option>
		<option value="dark">{$_('preferences.theme.dark')}</option>
	</select>
</div>
