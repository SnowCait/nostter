<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { WebStorage } from '$lib/WebStorage';
	import { imageOptimization } from '$lib/stores/Preference';
	import { imageOptimizerServers } from '$lib/Constants';
	import { onMount } from 'svelte';

	onMount(() => {
		const unsubscribe = imageOptimization.subscribe((value) => {
			const storage = new WebStorage(localStorage);
			storage.set('preference:image-optimization', value);
		});

		return () => {
			unsubscribe();
		};
	});
</script>

<label for="image-optimization-server">{$_('preferences.image_optimization')}</label>
<select id="image-optimization-server" bind:value={$imageOptimization}>
	<option value="">{$_('preferences.image_optimization_none')}</option>
	{#each imageOptimizerServers as server}
		<option value={server}>{server}</option>
	{/each}
</select>

<style>
	select {
		width: 100%;
		padding: 0.3rem;
		border: var(--default-border);
	}
</style>
