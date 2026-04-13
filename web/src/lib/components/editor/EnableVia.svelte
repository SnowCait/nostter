<script lang="ts">
	import { via, ViaOption } from '$lib/author/Via';
	import { appName } from '$lib/Constants';
	import { IconPaw } from '@tabler/icons-svelte';
	import { _ } from 'svelte-i18n';

	interface Props {
		enable: boolean;
	}

	let { enable = $bindable() }: Props = $props();

	$effect(() => {
		enable = $via !== 'none';
	});
</script>

<div>
	<span class="icon">
		<IconPaw size="20" color="var(--accent)" />
	</span>
	<span>via {appName}</span>
	<select id="via" bind:value={$via}>
		{#each ViaOption as value}
			<option {value}>{$_(`via.${value}`)}</option>
		{/each}
	</select>
</div>

<style>
	.icon {
		display: inline-flex;
	}

	div {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--foreground);
	}
</style>
