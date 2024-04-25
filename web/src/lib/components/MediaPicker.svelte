<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import IconPhoto from '@tabler/icons-svelte/dist/svelte/icons/IconPhoto.svelte';

	export let multiple = false;

	let input: HTMLInputElement | undefined;
	let files: FileList;

	const dispatch = createEventDispatcher();
</script>

<button on:click|preventDefault={() => input?.click()} class="clear">
	<IconPhoto size="30" />
</button>
<input
	type="file"
	{multiple}
	bind:this={input}
	bind:files
	on:change={() => dispatch('pick', files)}
	accept="image/*,video/*,audio/*"
	hidden
/>

<style>
	button {
		color: var(--accent);
	}
</style>
