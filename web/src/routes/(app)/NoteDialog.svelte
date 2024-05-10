<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { openNoteDialog } from '$lib/stores/NoteDialog';
	import { emojiPickerOpen } from '$lib/components/EmojiPicker.svelte';
	import NoteEditor from '$lib/components/editor/NoteEditor.svelte';
	import IconX from '@tabler/icons-svelte/dist/svelte/icons/IconX.svelte';

	let content: string;

	let dialog: HTMLDialogElement;
	let editor: NoteEditor;

	openNoteDialog.subscribe(async (open) => {
		console.log('[note dialog open]', open);
		if (open) {
			dialog.showModal();
		}
	});

	function closeDialog(event: MouseEvent) {
		if (emojiPickerOpen || !dialog.open) {
			return;
		}

		let target: HTMLElement | null = event.target as HTMLElement;
		if (target) {
			while (target) {
				if (target?.classList.contains('note-editor')) {
					return;
				}
				target = target.parentElement;
			}
		}

		const insideDialog =
			event.x >= dialog.offsetLeft &&
			event.x <= dialog.offsetLeft + dialog.offsetWidth &&
			event.y >= dialog.offsetTop &&
			event.y <= dialog.offsetTop + dialog.offsetHeight;

		if (!insideDialog) {
			closeIfNotEmpty();
		}
	}

	function closed(): void {
		console.log(`[note dialog close]`);
		editor.clear();
	}

	function closeIfNotEmpty(): void {
		if (content === '' || confirm($_('editor.close.confirm'))) {
			dialog.close();
		}
	}
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<dialog
	bind:this={dialog}
	on:click={closeDialog}
	on:close={closed}
	on:cancel|preventDefault={closeIfNotEmpty}
>
	<button class="clear close" on:click={closeIfNotEmpty}><IconX /></button>
	<NoteEditor bind:this={editor} bind:content on:sent={close} />
</dialog>

<style>
	dialog {
		border: var(--border);
		border-radius: var(--radius);
		max-width: 600px;
		margin: 0 auto;
		z-index: 1;
		width: 100%;
		overflow: visible;
	}

	button.close {
		color: var(--foreground);
		width: 24px;
		height: 24px;
		margin: 0.5rem;
	}

	@media screen and (max-width: 600px) {
		dialog {
			width: 90%;
		}
	}
</style>
