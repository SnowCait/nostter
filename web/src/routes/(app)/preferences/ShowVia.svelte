<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { showVia } from '$lib/ShowVia';
</script>

<label>
	<input type="checkbox" bind:checked={$showVia} />
	<span>{$_('preferences.show_via')}</span>
</label>
