<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { autoRefresh } from '$lib/stores/Preference';

	let needRefresh = $state(false);
</script>

<label>
	<input type="checkbox" bind:checked={$autoRefresh} onchange={() => (needRefresh = true)} />
	<span>{$_('preferences.auto_refresh')}</span>
</label>
{#if needRefresh}
	<div>Please <a href="/" data-sveltekit-reload>reload</a></div>
{/if}
