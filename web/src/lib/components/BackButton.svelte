<script lang="ts">
	import IconArrowLeft from '@tabler/icons-svelte/icons/arrow-left';

	function back(): void {
		history.back();
	}
</script>

<button on:click={back} class="clear clickable">
	<IconArrowLeft />
</button>

<style>
	button {
		padding: 6px;
	}
</style>
