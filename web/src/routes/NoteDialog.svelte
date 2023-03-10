<script lang="ts" context="module">
	interface Window {
		// NIP-07
		nostr: any;
	}
	declare var window: Window;
</script>

<script lang="ts">
	import { pool } from '../stores/Pool';
	import { pubkey, relays } from '../stores/Author';
	import { openNoteDialog } from '../stores/NoteDialog';

	let content = '';
	let posting = false;
	let dialog: HTMLDialogElement;

	openNoteDialog.subscribe((open) => {
		console.log('[open]', open);
		if (open) {
			dialog.showModal();
		}
	});

	function closeDialog(event: MouseEvent) {
		console.debug('[click]', `(${event.x}, ${event.y})`);

		const insideDialog =
			event.x >= dialog.offsetLeft &&
			event.x <= dialog.offsetLeft + dialog.offsetWidth &&
			event.y >= dialog.offsetTop &&
			event.y <= dialog.offsetTop + dialog.offsetHeight;

		if (!insideDialog) {
			$openNoteDialog = false;
			dialog.close();
		}
	}

	async function submitFromKeyboard(event: KeyboardEvent) {
		console.debug(`[${event.type}]`, event.code, event.key, event.ctrlKey, event.metaKey);
		if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
			await postNote();
		}
	}

	async function postNote() {
		if (content === '') {
			console.log('Content is empty');
			return;
		}

		posting = true;
		const event = await window.nostr.signEvent({
			created_at: Math.round(Date.now() / 1000),
			kind: 1,
			tags: [],
			content
		});
		console.log(event);

		$pool.publish(
			Array.from($relays).map((x) => x.href),
			event
		);

		content = '';
		posting = false;
	}
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<dialog bind:this={dialog} on:click={closeDialog}>
	<form on:submit|preventDefault={postNote}>
		<textarea
			placeholder="いまどうしてる？"
			bind:value={content}
			on:keydown={submitFromKeyboard}
		/>
		<input type="submit" value="投稿する" disabled={!pubkey || posting} />
	</form>
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

	textarea {
		width: 100%;
		height: 4em;
	}

	input {
		display: block;
		margin-left: auto;
	}
</style>
