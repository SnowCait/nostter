<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { WebStorage } from '$lib/WebStorage';
	import { auth } from '$lib/auth.svelte';

	function clearAndReload() {
		const storage = new WebStorage(localStorage);
		const accountPubkey = auth.pubkey;
		if (accountPubkey !== undefined) storage.removeCachedAt(accountPubkey);
		location.href = '/';
	}
</script>

<button onclick={clearAndReload}>{$_('preferences.clear_event_cache')}</button>
