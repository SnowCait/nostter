<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { preferencesStore, savePreferences } from '$lib/Preferences';
	import {
		contactsOfFolloweesReqEmit,
		followeesOfFollowees
	} from '$lib/author/MuteAutomatically';
	import { developerMode } from '$lib/stores/Preference';

	let enable = $preferencesStore.muteAutomatically;

	async function changed(): Promise<void> {
		console.log('[preferences mute automatically changed]', enable);
		$preferencesStore.muteAutomatically = enable;
		await savePreferences();

		if (enable) {
			contactsOfFolloweesReqEmit();
		}
	}
</script>

<label>
	<input type="checkbox" bind:checked={enable} on:change={changed} />
	<span>{$_('preferences.mute.automatically')}</span>
	{#if enable && $developerMode}
		<span>({$followeesOfFollowees.size})</span>
	{/if}
</label>
