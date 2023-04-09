<script lang="ts" context="module">
	interface Window {
		// NIP-07
		nostr: any;
	}
	declare var window: Window;
</script>

<script lang="ts">
	import { pool } from '../stores/Pool';
	import { pubkey, rom, relayUrls } from '../stores/Author';
	import { openNoteDialog, replyTo, quotes, intentContent } from '../stores/NoteDialog';
	import Note from './timeline/Note.svelte';
	import { IconSend } from '@tabler/icons-svelte';
	import { Api } from '$lib/Api';

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

	intentContent.subscribe((value) => {
		console.log('[content override]');

		content = value;
		value = '';
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

		if ($rom) {
			console.error('Readonly');
			return;
		}

		let tags: string[][] = [];
		if ($replyTo !== undefined) {
			if ($replyTo.tags.filter((x) => x[0] === 'e').length === 0) {
				// root
				tags.push(['e', $replyTo.id, '', 'root']);
			} else {
				// reply
				tags.push(['e', $replyTo.id, '', 'reply']);
				const root = $replyTo.tags.find(
					([tagName, , , marker]) => tagName === 'e' && marker === 'root'
				);
				if (root !== undefined) {
					tags.push(['e', root[1], '', 'root']);
				}
			}
			const pubkeys = new Set([
				$replyTo.pubkey,
				...$replyTo.tags.filter((x) => x[0] === 'p').map((x) => x[1])
			]);
			tags.push(...Array.from(pubkeys).map((pubkey) => ['p', pubkey]));
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
		console.log('[publish]', event);

		const api = new Api($pool, $relayUrls);
		const success = await api.publish(event);
		posting = false;
		if (success) {
			console.log('[success]');
			dialog.close();
		} else {
			console.error('[failure]');
		}
	}
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<dialog bind:this={dialog} on:click={closeDialog} on:close={closed}>
	{#if $replyTo}
		<Note event={$replyTo} readonly={true} />
	{/if}
	<form on:submit|preventDefault={postNote}>
		<textarea
			placeholder="いまどうしてる？"
			bind:value={content}
			bind:this={textarea}
			on:keydown={submitFromKeyboard}
		/>
		<input id="send" type="submit" disabled={!pubkey || posting} />
		<label for="send"><IconSend size={30} /></label>
	</form>
	{#if $quotes.length > 0}
		{#each $quotes as quote}
			<Note event={quote} readonly={true} />
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

	label {
		display: block;
		margin-left: auto;
		width: 30px;
	}

	input[type='submit'] {
		display: none;
	}

	input[type='submit']:disabled + label {
		color: lightgray;
	}
</style>
