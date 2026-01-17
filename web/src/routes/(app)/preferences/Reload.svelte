<script lang="ts">
	import { _ } from 'svelte-i18n';

	function reload(): void {
		location.href = '/';
	}
</script>

<button onclick={reload}>{$_('preferences.reload')}</button>
