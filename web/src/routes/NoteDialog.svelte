<script lang="ts">
	import { openNoteDialog, replyTo, quotes, intentContent } from '../stores/NoteDialog';
	import Note from './timeline/Note.svelte';
	// import { nip19 } from 'nostr-tools';
	import NoteEditorCore from './NoteEditorCore.svelte';

	let dialog: HTMLDialogElement;
	// let autocompleting = false;

	openNoteDialog.subscribe((open) => {
		console.log('[open]', open);
		if (open) {
			// if ($quotes.length > 0) {
			// 	content =
			// 		'\n' + $quotes.map((event) => `nostr:${nip19.noteEncode(event.id)}`).join('\n');
			// }
			dialog.showModal();
		}
	});

	intentContent.subscribe((value) => {
		console.log('[content override]');

		// content = value;
		value = '';
	});

	function closeDialog(event: MouseEvent) {
		console.debug('[click]', `(${event.x}, ${event.y})`);

		// if (autocompleting) {
		// 	return;
		// }

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
		$openNoteDialog = false;
		// content = '';
		// pubkeys.clear();
		// $replyTo = undefined;
		// $quotes = [];
		// exitComplement();
	}
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<dialog bind:this={dialog} on:click={closeDialog} on:close={closed}>
	{#if $replyTo}
		<Note event={$replyTo} readonly={true} />
	{/if}
	<NoteEditorCore />
</dialog>

<style>
	dialog {
		border: 1px;
		border-style: solid;
		border-color: lightgray;
		border-radius: 10px;
		max-width: 100%;
		margin: 0 auto;
		z-index: 1;
		width: 50%;
	}
</style>
