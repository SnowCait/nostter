<script lang="ts">
	import IconPhoto from '@tabler/icons-svelte-runes/icons/photo';
	import { _ } from 'svelte-i18n';

	interface Props {
		multiple?: boolean;
		disabled?: boolean;
		onPick?: (files: FileList) => void;
	}

	let { multiple = false, disabled = false, onPick }: Props = $props();

	let input = $state<HTMLInputElement>();
	let files = $state<FileList>();

	function onclick(e: MouseEvent): void {
		e.preventDefault();
		if (disabled) return;
		input?.click();
	}

	function onchange(): void {
		if (!disabled && files !== undefined) onPick?.(files);
		if (input !== undefined) {
			input.value = '';
		}
	}
</script>

<button {onclick} {disabled} class="clear composer-option active" title={$_('media.title')}>
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
