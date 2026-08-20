<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import IconPhoto from '@tabler/icons-svelte-runes/icons/photo';
	import { _ } from 'svelte-i18n';

	interface Props {
		multiple?: boolean;
		disabled?: boolean;
	}

	let { multiple = false, disabled = false }: Props = $props();

	let input = $state<HTMLInputElement>();
	let files = $state<FileList>();

	const dispatch = createEventDispatcher();

	function onclick(e: MouseEvent): void {
		e.preventDefault();
		if (disabled) return;
		input?.click();
	}

	function onchange(): void {
		if (!disabled) dispatch('pick', files);
		if (input !== undefined) {
			input.value = '';
		}
	}
</script>

<button {onclick} {disabled} class="clear editor-option active" title={$_('media.title')}>
	<IconPhoto size="20" />
</button>
<input
	type="file"
	{disabled}
	{multiple}
	bind:this={input}
	bind:files
	{onchange}
	accept="image/*,video/*,audio/*"
	hidden
/>
