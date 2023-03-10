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
	import { openNoteDialog, replyTo, quotes } from '../stores/NoteDialog';
	import NoteView from './NoteView.svelte';

	let content = '';
	let posting = false;
	let dialog: HTMLDialogElement;
	let textarea: HTMLTextAreaElement;

	openNoteDialog.subscribe((open) => {
		console.log('[open]', open);
		if (open) {
			if ($quotes.length > 0) {
				content = $quotes.map((x, i) => `\n#[${i}]`).join('');
			}
			// Wait for content updated
			setTimeout(() => {
				console.log(textarea, textarea.selectionStart);
				textarea.setSelectionRange(0, 0);
				dialog.showModal();
				textarea.focus();
			}, 10);
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
			dialog.close();
		}
	}

	async function closed(event: Event) {
		console.log(`[${event.type}]`);
		$openNoteDialog = false;
		content = '';
		$replyTo = undefined;
		$quotes = [];
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

		let tags: string[][] = [];
		if ($replyTo !== undefined) {
			if ($replyTo.tags.filter((x) => x[0] === 'e').length === 0) {
				// root
				tags.push(['e', $replyTo.id, '', 'root']);
				tags.push(['p', $replyTo.pubkey]);
			} else {
				// reply
				tags.push(['e', $replyTo.id, '', 'reply']);
				const root = $replyTo.tags.find(
					([tagName, , , marker]) => tagName === 'e' && marker === 'root'
				);
				if (root !== undefined) {
					tags.push(['e', root[1], '', 'root']);
				}
				const pubkeys = new Set([
					$replyTo.pubkey,
					...$replyTo.tags.filter((x) => x[0] === 'p').map((x) => x[1])
				]);
				tags.push(...Array.from(pubkeys).map((pubkey) => ['p', pubkey]));
			}
		}

		if ($quotes.length > 0) {
			for (const quote of $quotes) {
				tags.push(['e', quote.id, '', 'mention']);
			}
		}

		posting = true;
		const event = await window.nostr.signEvent({
			created_at: Math.round(Date.now() / 1000),
			kind: 1,
			tags,
			content
		});
		console.log(event);

		$pool.publish(
			Array.from($relays).map((x) => x.href),
			event
		);

		posting = false;

		dialog.close();
	}
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<dialog bind:this={dialog} on:click={closeDialog} on:close={closed}>
	{#if $replyTo}
		<NoteView event={$replyTo} readonly={true} />
	{/if}
	<form on:submit|preventDefault={postNote}>
		<textarea
			placeholder="????????????????????????"
			bind:value={content}
			bind:this={textarea}
			on:keydown={submitFromKeyboard}
		/>
		<input type="submit" value="????????????" disabled={!pubkey || posting} />
	</form>
	{#if $quotes.length > 0}
		{#each $quotes as quote}
			<NoteView event={quote} readonly={true} />
		{/each}
	{/if}
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
