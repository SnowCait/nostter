<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { preferencesStore, savePreferences } from '$lib/Preferences';
	import {
		contactsOfFolloweesReqEmit,
		followeesOfFollowees
	} from '$lib/author/MuteAutomatically';
	import { developerMode } from '$lib/stores/Preference';

	let enable = $state($preferencesStore.muteAutomatically);

	async function changed(): Promise<void> {
		console.log('[preferences mute automatically changed]', enable);
		$preferencesStore.muteAutomatically = enable;
		await savePreferences();

		if (enable) {
			contactsOfFolloweesReqEmit();
		}
	}
</script>

<div>
	<p>{$_('preferences.notification.visibility.migration')}</p>
	<label>
		<input type="checkbox" bind:checked={enable} onchange={changed} disabled={true} />
		<span>{$_('preferences.mute.automatically')}</span>
		{#if enable && $developerMode}
			<span>(followees: {$followeesOfFollowees.size})</span>
		{/if}
	</label>
</div>

<style>
	div {
		border: var(--default-border);
		border-radius: 5px;
		padding: 0.5rem;
	}

	p {
		margin: 0.3rem;
		padding: 0.5rem;
		color: var(--accent-surface);
		background-color: var(--accent-gray);
		border-radius: 5px;
	}
</style>
