<script lang="ts">
	import { _, locale } from 'svelte-i18n';
	import { writable, type Writable } from 'svelte/store';
	import { browser } from '$app/environment';
	import { WebStorage } from '$lib/WebStorage';

	let language: Writable<'system' | 'ja' | 'en'>;
	if (browser) {
		const storage = new WebStorage(localStorage);
		language = writable((storage.get('language') as 'system' | 'ja' | 'en' | null) ?? 'system');
		language.subscribe((v) => {
			console.log('[language]', v);
			storage.set('language', v);

			let targetLang: string;
			if (v === 'ja') {
				console.log('[language local]', 'ja');
				targetLang = 'ja';
			} else if (v === 'en') {
				console.log('[language local]', 'en');
				targetLang = 'en';
			} else {
				if (window.navigator.language.startsWith('ja')) {
					console.log('[language system]', 'ja');
					targetLang = 'ja';
				} else {
					console.log('[language system]', 'en');
					targetLang = 'en';
				}
			}

			document.documentElement.lang = targetLang;
			locale.set(targetLang);
		});
	}
</script>

<div>
	<label for="language-select">{$_('preferences.language.language')}:</label>
	<select bind:value={$language} id="language-select">
		<option value="system">{$_('preferences.language.system')}</option>
		<option value="ja">{$_('preferences.language.ja')}</option>
		<option value="en">{$_('preferences.language.en')}</option>
	</select>
</div>
