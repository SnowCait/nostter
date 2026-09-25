<script lang="ts">
	import { accountAddressableEventCache } from '$lib/cache/Events';
	import { _ } from 'svelte-i18n';

	async function clearAndReload() {
		await accountAddressableEventCache.clear();
		location.href = '/';
	}
</script>

<button onclick={clearAndReload}>{$_('preferences.clear_event_cache')}</button>
