<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { openNoteDialog } from '$lib/stores/NoteDialog';
	import { emojiPickerOpen } from '$lib/components/EmojiPicker.svelte';
	import NoteEditor from '$lib/components/editor/NoteEditor.svelte';
	import IconX from '@tabler/icons-svelte/icons/x';

	let content: string;

	let dialog: HTMLDialogElement | undefined;
	let editor: NoteEditor;

	openNoteDialog.subscribe(async (open) => {
		console.log('[note dialog open]', open);
		if (open) {
			dialog?.showModal();
		}
	});

	function tryClose(e: MouseEvent): void {
		if (emojiPickerOpen || !dialog?.open) {
			return;
		}

		const element = (e.target as Element).closest('.dialog-content');
		console.debug('[dialog try close]', element, dialog);
		if (element === null && dialog !== undefined) {
			closeIfNotEmpty();
		}
	}

	function closed(): void {
		console.log(`[note dialog close]`);
		editor.clear();
	}

	function closeIfNotEmpty(): void {
		if (content === '' || confirm($_('editor.close.confirm'))) {
			dialog?.close();
		}
	}
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<dialog
	bind:this={dialog}
	on:click={tryClose}
	on:close={closed}
	on:cancel|preventDefault={closeIfNotEmpty}
>
	<div class="dialog-content">
		<button
			class="clear close clickable"
			on:click={closeIfNotEmpty}
			title={$_('editor.close.button')}
		>
			<IconX />
		</button>
		<NoteEditor bind:this={editor} bind:content on:sent={closeIfNotEmpty} />
	</div>
</dialog>

<style>
	dialog {
		border: var(--border);
		border-radius: var(--radius);
		max-width: 600px;
		margin: 1rem auto;
		z-index: 1;
		width: 100%;
		overflow: visible;
	}

	button.close {
		width: 36px;
		height: 36px;
		padding: 6px;
		margin: 0.4rem;
	}

	@media screen and (max-width: 600px) {
		dialog {
			width: 90%;
		}
	}
</style>
