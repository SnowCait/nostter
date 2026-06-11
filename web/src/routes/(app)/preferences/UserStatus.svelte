<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { showUserStatus } from '$lib/preferences/UserStatus';
</script>

<label>
	<input type="checkbox" bind:checked={$showUserStatus} />
	<span>{$_('preferences.user_status')}</span>
</label>
