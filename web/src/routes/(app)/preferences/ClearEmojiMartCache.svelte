<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { browser } from '$app/environment';

	const keys = ['emoji-mart.last', 'emoji-mart.frequently'];

	function clear() {
		if (!browser) {
			return;
		}

		for (const key of keys) {
			localStorage.removeItem(key);
		}
	}
</script>

<button on:click={clear}>{$_('preferences.clear_emoji_cache')}</button>
