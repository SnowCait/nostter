<script lang="ts">
	import IconArrowLeft from '@tabler/icons-svelte/icons/arrow-left';

	function back(): void {
		history.back();
	}
</script>

<button on:click={back} class="clear">
	<IconArrowLeft />
</button>

<style>
	button {
		color: var(--foreground);
		padding: 6px;
		border-radius: 50%;
	}

	button:hover {
		background-color: var(--accent-surface);
	}
</style>
