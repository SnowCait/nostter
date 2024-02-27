<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { autoRefresh } from '../../../stores/Preference';

	let needRefresh = false;
</script>

<label>
	<input type="checkbox" bind:checked={$autoRefresh} on:change={() => (needRefresh = true)} />
	<span>{$_('preferences.auto_refresh')}</span>
</label>
{#if needRefresh}
	<div>Please <a href="/" data-sveltekit-reload>reload</a></div>
{/if}
