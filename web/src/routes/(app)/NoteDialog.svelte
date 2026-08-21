<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { openNoteDialog } from '$lib/stores/NoteDialog';
	import { emojiPickerOpen } from '$lib/components/EmojiPicker.svelte';
	import NoteComposer from '$lib/components/editor/NoteComposer.svelte';
	import IconX from '@tabler/icons-svelte-runes/icons/x';

	let content = $state('');
	let hasAttachments = $state(false);
	let editorBusy = $state(false);

	let dialog = $state<HTMLDialogElement>();
	let editor = $state<NoteComposer>();

	openNoteDialog.subscribe(async (open) => {
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
		editor?.clear(true);
	}

	function closeIfNotEmpty(e?: Event): void {
		e?.preventDefault();
		if (editorBusy) return;
		if ((content === '' && !hasAttachments) || confirm($_('editor.close.confirm'))) {
			dialog?.close();
		}
	}

	function sent(): void {
		dialog?.close();
	}
</script>

<dialog bind:this={dialog} onclick={tryClose} onclose={closed} oncancel={closeIfNotEmpty}>
	<div class="dialog-content">
		<button
			class="clear close clickable active"
			onclick={closeIfNotEmpty}
			disabled={editorBusy}
			title="{$_('editor.close.button')} (Esc)"
		>
			<IconX />
		</button>
		<NoteComposer
			bind:this={editor}
			bind:content
			bind:hasAttachments
			bind:busy={editorBusy}
			on:sent={sent}
		/>
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
