<script lang="ts">
	import {
		contactsOfFolloweesReqEmit,
		followeesOfFollowees
	} from '$lib/author/MuteAutomatically';
	import { preferencesStore, savePreferences } from '$lib/Preferences';
	import {
		notificationVisibilities,
		notificationVisibility
	} from '$lib/preferences/NotificationVisibility.svelte';
	import { developerMode } from '$lib/stores/Preference';
	import { _ } from 'svelte-i18n';

	$effect(() => {
		console.debug('[notification visibility]', $notificationVisibility);
		if ($notificationVisibility === 'follows_of_follows') {
			contactsOfFolloweesReqEmit();
		}
	});

	//#region Migration

	let saving = false;

	function onchange() {
		if ($preferencesStore.muteAutomatically === undefined || saving) {
			return;
		}

		saving = true;
		$preferencesStore.muteAutomatically = undefined;
		savePreferences().finally(() => {
			saving = false;
		});
	}

	//#endregion
</script>

<h3>{$_('preferences.notification.visibility.title')}</h3>
<select bind:value={$notificationVisibility} {onchange}>
	{#each notificationVisibilities as visibility}
		<option value={visibility}>
			{$_(`preferences.notification.visibility.${visibility}`)}
		</option>
	{/each}
</select>
{#if $notificationVisibility === 'follows_of_follows' && $developerMode}
	<span>
		({$followeesOfFollowees.size})
	</span>
{/if}
