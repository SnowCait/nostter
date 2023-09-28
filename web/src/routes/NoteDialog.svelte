<script lang="ts">
	import { openNoteDialog } from '../stores/NoteDialog';
	import NoteEditor from './editor/NoteEditor.svelte';

	let dialog: HTMLDialogElement;
	let editor: NoteEditor;

	openNoteDialog.subscribe(async (open) => {
		console.log('[note dialog open]', open);
		if (open) {
			dialog.showModal();
		}
	});

	function closeDialog(event: MouseEvent) {
		if (editor.isAutocompleting()) {
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
			dialog.close();
		}
	}

	async function closed(event: Event) {
		console.log(`[${event.type}]`);
		editor.clear();
	}

	function close() {
		dialog.close();
	}
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<dialog bind:this={dialog} on:click={closeDialog} on:close={closed}>
	<NoteEditor bind:this={editor} on:sent={close} />
</dialog>

<style>
	dialog {
		border: var(--border);
		border-radius: var(--radius);
		max-width: 600px;
		margin: 0 auto;
		z-index: 1;
		width: 100%;
	}

	@media screen and (max-width: 600px) {
		dialog {
			width: 90%;
		}
	}
</style>
