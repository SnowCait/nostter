<script lang="ts">
	import {
		contactsOfFolloweesReqEmit,
		followeesOfFollowees
	} from '$lib/author/MuteAutomatically';
	import {
		notificationVisibilities,
		notificationVisibility
	} from '$lib/preferences/NotificationVisibility.svelte';
	import { developerMode } from '$lib/stores/Preference';
	import { auth } from '$lib/auth.svelte';
	import { _ } from 'svelte-i18n';

	$effect(() => {
		console.debug('[notification visibility]', $notificationVisibility);
		if ($notificationVisibility === 'follows_of_follows') {
			contactsOfFolloweesReqEmit(auth.followees);
		}
	});
</script>

<h3>{$_('preferences.notification.visibility.title')}</h3>
<select bind:value={$notificationVisibility}>
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
