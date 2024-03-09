<script lang="ts">
	import { NativeSelect } from '@svelteuidev/core';
	import { _ } from 'svelte-i18n';
	import { fileStorageServers } from '$lib/Constants';
	import { getMediaUploader } from '$lib/media/Media';
	import { preferencesStore, savePreferences } from '$lib/Preferences';
	import { fetchNip96 } from '$lib/media/FileStorageServer';

	let server = getMediaUploader();

	async function save(): Promise<void> {
		console.log('[preferences media uploader changed]', server);
		try {
			await fetchNip96(server);
			$preferencesStore.mediaUploader = server;
			savePreferences();
		} catch (error) {
			console.error('[preferences media uploader not found]', server, error);
		}
	}
</script>

<span>{$_('preferences.media_uploader.title')}</span>
<NativeSelect
	data={fileStorageServers.map((server) => {
		return {
			label: new URL(server).hostname,
			value: server
		};
	})}
	bind:value={server}
	on:change={save}
/>
