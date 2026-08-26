<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { nip19 } from 'nostr-tools';
	import { noteDialogContent, quotes, replyTo } from '$lib/stores/NoteDialog';
	import type { NoteDialogOpenRequest } from '$lib/NoteDialogContext';
	import { getSeenOnRelays } from '$lib/timelines/MainTimeline';
	import { emojiPickerOpen } from '$lib/components/EmojiPicker.svelte';
	import NoteComposer from '$lib/components/composer/NoteComposer.svelte';
	import IconX from '@tabler/icons-svelte-runes/icons/x';

	let hasAttachments = $state(false);
	let composerBusy = $state(false);

	let dialog = $state<HTMLDialogElement>();
	let composer = $state<NoteComposer>();

	export async function open(request: NoteDialogOpenRequest = {}): Promise<void> {
		if (request.replyTo !== undefined) {
			$replyTo = request.replyTo;
		}
		if (request.quotes !== undefined) {
			$quotes = request.quotes;
			$noteDialogContent =
				'\n' +
				request.quotes
					.map(
						(event) =>
							`nostr:${nip19.neventEncode({
								id: event.id,
								relays: getSeenOnRelays(event.id),
								author: event.pubkey,
								kind: event.kind
							})}`
					)
					.join('\n');
		}
		if (request.content !== undefined) {
			$noteDialogContent = request.content;
		}

		if (dialog === undefined || dialog.open) {
			return;
		}
		dialog.showModal();
		await composer?.focus();
	}

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
		composer?.clear(true);
		$noteDialogContent = '';
	}

	function closeIfNotEmpty(e?: Event): void {
		e?.preventDefault();
		if (composerBusy) return;
		if (($noteDialogContent === '' && !hasAttachments) || confirm($_('editor.close.confirm'))) {
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
			disabled={composerBusy}
			title="{$_('editor.close.button')} (Esc)"
		>
			<IconX />
		</button>
		<NoteComposer
			bind:this={composer}
			bind:content={$noteDialogContent}
			bind:hasAttachments
			bind:busy={composerBusy}
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
