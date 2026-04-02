<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import IconPhoto from '@tabler/icons-svelte/icons/photo';
	import { _ } from 'svelte-i18n';

	interface Props {
		multiple?: boolean;
	}

	let { multiple = false }: Props = $props();

	let input = $state<HTMLInputElement>();
	let files = $state<FileList>();

	const dispatch = createEventDispatcher();

	function onclick(e: MouseEvent): void {
		e.preventDefault();
		input?.click();
	}

	function onchange(): void {
		dispatch('pick', files);
		if (input !== undefined) {
			input.value = '';
		}
	}
</script>

<button {onclick} class="clear editor-option active" title={$_('media.title')}>
	<IconPhoto size="20" />
</button>
<input
	type="file"
	{multiple}
	bind:this={input}
	bind:files
	{onchange}
	accept="image/*,video/*,audio/*"
	hidden
/>
