<script lang="ts">
	import { autoRefresh } from '../../stores/Preference';

	let needRefresh = false;
</script>

<label>
	<input type="checkbox" bind:checked={$autoRefresh} on:change={() => (needRefresh = true)} />
	<span>Auto refresh</span>
</label>
{#if needRefresh}
	<div>Please <a href="/" data-sveltekit-reload>refresh</a></div>
{/if}
