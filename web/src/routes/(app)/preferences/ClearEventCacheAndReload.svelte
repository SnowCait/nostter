<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { WebStorage } from '$lib/WebStorage';

	function clearAndReload() {
		const storage = new WebStorage(localStorage);
		storage.remove('cached_at');
		location.href = '/';
	}
</script>

<button onclick={clearAndReload}>{$_('preferences.clear_event_cache')}</button>
