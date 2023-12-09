<script lang="ts">
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

			const color = getComputedStyle(document.documentElement).getPropertyValue('--background')
			let themeColorMetaTag: HTMLMetaElement = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement
			themeColorMetaTag.content = color

		});
	}
</script>

<div>
	<label for="theme-select">Theme:</label>
	<select bind:value={$theme} id="theme-select">
		<option value="system">System</option>
		<option value="light">Light</option>
		<option value="dark">Dark</option>
	</select>
</div>

<style>
	select {
		color: inherit;
	}
</style>
