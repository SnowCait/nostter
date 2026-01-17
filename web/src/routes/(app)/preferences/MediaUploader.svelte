<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { fileStorageServers } from '$lib/Constants';
	import { getMediaUploader } from '$lib/media/Media';
	import { preferencesStore, savePreferences } from '$lib/Preferences';
	import { fetchNip96 } from '$lib/media/FileStorageServer';

	let server = $state(getMediaUploader());

	async function save(): Promise<void> {
		console.debug('[preferences media uploader changed]', server);
		try {
			await fetchNip96(server);
			$preferencesStore.mediaUploader = server;
			savePreferences();
		} catch (error) {
			console.error('[preferences media uploader not found]', server, error);
		}
	}
</script>

<label for="file-storage-server">{$_('preferences.media_uploader.title')}</label>
<select id="file-storage-server" bind:value={server} onchange={save}>
	{#each fileStorageServers as server}
		<option value={server}>{new URL(server).hostname}</option>
	{/each}
</select>

<style>
	select {
		width: 100%;
		padding: 0.3rem;
		border: var(--default-border);
	}
</style>
