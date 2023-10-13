<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import IconPhoto from '@tabler/icons-svelte/dist/svelte/icons/IconPhoto.svelte';

	let input: HTMLInputElement | undefined;
	let files: FileList;

	const dispatch = createEventDispatcher();
</script>

<button on:click|preventDefault={() => input?.click()} class="clear">
	<IconPhoto size="30" />
</button>
<input type="file" bind:this={input} bind:files on:change={() => dispatch('pick', files)} accept="image/*" hidden>

<style>
	button {
		color: var(--accent);
	}
</style>
