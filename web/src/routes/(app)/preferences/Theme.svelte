<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { writable, type Writable } from 'svelte/store';
	import { browser } from '$app/environment';
	import { WebStorage } from '$lib/WebStorage';

	let theme: Writable<'system' | 'light' | 'dark'>;
	if (browser) {
		const storage = new WebStorage(localStorage);
		theme = writable((storage.get('theme') as 'system' | 'light' | 'dark' | null) ?? 'system');
		theme.subscribe((v) => {
			console.log('[theme]', v);
			storage.set('theme', v);
			if (v === 'dark') {
				console.log('[theme local]', 'dark');
				document.documentElement.classList.add('dark');
			} else if (v === 'light') {
				console.log('[theme local]', 'light');
				document.documentElement.classList.remove('dark');
			} else {
				if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
					console.log('[theme system]', 'dark');
					document.documentElement.classList.add('dark');
				} else {
					console.log('[theme system]', 'light');
					document.documentElement.classList.remove('dark');
				}
			}

			const color = getComputedStyle(document.documentElement).getPropertyValue(
				'--background'
			);
			let themeColorMetaTag: HTMLMetaElement = document.querySelector(
				'meta[name="theme-color"]'
			) as HTMLMetaElement;
			themeColorMetaTag.content = color;
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

<style>
	select {
		color: inherit;
	}
</style>
