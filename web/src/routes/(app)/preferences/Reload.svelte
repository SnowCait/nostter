<script lang="ts">
	import { _ } from 'svelte-i18n';

	function reload(): void {
		location.href = '/';
	}
</script>

<button on:click={reload}>{$_('preferences.reload')}</button>
