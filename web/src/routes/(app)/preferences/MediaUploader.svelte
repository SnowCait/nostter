<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { get } from 'svelte/store';
	import { fileStorageServers } from '$lib/Constants';
	import { auth } from '$lib/auth.svelte';
	import { blossomServerListEvent } from '$lib/stores/Author';
	import { resolveBlossomServer } from '$lib/media/Blossom';
	import {
		getAccountLocalPreferences,
		mediaUploaderPreferenceValue,
		setMediaUploaderPreference,
		type MediaUploaderPreference
	} from '$lib/preferences/AccountLocalPreferences';
	import { fetchNip96 } from '$lib/media/FileStorageServer';

	const accountLocalPreferences = getAccountLocalPreferences(auth.pubkey);
	const blossomServer = $derived(resolveBlossomServer($blossomServerListEvent));
	let selection = $state(
		mediaUploaderPreferenceValue(
			get(accountLocalPreferences).mediaUploader ?? {
				type: 'blossom',
				server: resolveBlossomServer(get(blossomServerListEvent)).href
			}
		)
	);

	async function save(): Promise<void> {
		const preference: MediaUploaderPreference = selection.startsWith('nip96:')
			? { type: 'nip96', server: selection.slice('nip96:'.length) }
			: { type: 'blossom', server: blossomServer.href };
		console.debug('[preferences media uploader changed]', preference);
		try {
			if (preference.type === 'nip96') await fetchNip96(preference.server);
			setMediaUploaderPreference(accountLocalPreferences, preference);
		} catch (error) {
			console.error('[preferences media uploader not found]', preference, error);
		}
	}
</script>

<label for="file-storage-server">{$_('preferences.media_uploader.title')}</label>
<select id="file-storage-server" bind:value={selection} onchange={save}>
	<optgroup label={$_('preferences.media_uploader.recommended_blossom')}>
		<option value="blossom">{blossomServer.hostname}</option>
	</optgroup>
	<optgroup label={$_('preferences.media_uploader.other')}>
		{#each fileStorageServers as server}
			<option value={`nip96:${server}`}>{new URL(server).hostname}</option>
		{/each}
	</optgroup>
</select>

<style>
	select {
		width: 100%;
		padding: 0.3rem;
		border: var(--default-border);
	}
</style>
