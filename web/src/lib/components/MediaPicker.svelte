<script lang="ts">
	import { preventDefault } from 'svelte/legacy';

	import { createEventDispatcher } from 'svelte';
	import IconPhoto from '@tabler/icons-svelte/icons/photo';

	interface Props {
		multiple?: boolean;
	}

	let { multiple = false }: Props = $props();

	let input = $state<HTMLInputElement>();
	let files = $state<FileList>();

	const dispatch = createEventDispatcher();

	function onChange(): void {
		dispatch('pick', files);
		if (input !== undefined) {
			input.value = '';
		}
	}
</script>

<button onclick={preventDefault(() => input?.click())} class="clear">
	<IconPhoto size="30" />
</button>
<input
	type="file"
	{multiple}
	bind:this={input}
	bind:files
	onchange={onChange}
	accept="image/*,video/*,audio/*"
	hidden
/>

<style>
	button {
		color: var(--accent);
	}
</style>
