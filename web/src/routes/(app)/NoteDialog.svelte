<script lang="ts">
	import { Dialog } from 'bits-ui';
	import { tick } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { nip19 } from 'nostr-tools';
	import type * as Nostr from 'nostr-typedef';
	import type { EventItem } from '$lib/Items';
	import type { NoteDialogOpenRequest } from '$lib/NoteDialogContext';
	import { getSeenOnRelays } from '$lib/timelines/MainTimeline';
	import { emojiPickerOpen } from '$lib/components/EmojiPicker.svelte';
	import NoteComposer from '$lib/components/composer/NoteComposer.svelte';
	import IconX from '@tabler/icons-svelte-runes/icons/x';

	let composerBusy = $state(false);
	let content = $state('');
	let replyTo = $state<EventItem>();
	let quotes = $state<Nostr.Event[]>([]);

	let dialogOpen = $state(false);
	let composer = $state<NoteComposer>();

	export async function open(request: NoteDialogOpenRequest = {}): Promise<void> {
		if (request.replyTo !== undefined) {
			replyTo = request.replyTo;
		}
		if (request.quotes !== undefined) {
			quotes = request.quotes;
			content =
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
			content = request.content;
		}

		if (dialogOpen) {
			return;
		}
		dialogOpen = true;
		await tick();
		await composer?.focus();
	}

	function closed(): void {
		composer?.clear(true);
		content = '';
		replyTo = undefined;
		quotes = [];
	}

	function closeIfNotEmpty(e?: Event): void {
		e?.preventDefault();
		if (composerBusy) {
			return;
		}
		const composerHasAttachments = composer?.hasAttachments() ?? false;
		if ((content === '' && !composerHasAttachments) || confirm($_('editor.close.confirm'))) {
			void closeDialog();
		}
	}

	function handleSent(): void {
		replyTo = undefined;
		quotes = [];
	}

	async function closeDialog(): Promise<void> {
		closed();
		dialogOpen = false;
	}
</script>

<Dialog.Root bind:open={dialogOpen}>
	<Dialog.Portal>
		<Dialog.Overlay class="note-overlay" />
		<Dialog.Content
			class="note-panel"
			forceMount
			onOpenAutoFocus={(event) => event.preventDefault()}
			onEscapeKeydown={closeIfNotEmpty}
			onInteractOutside={(event) => {
				if (emojiPickerOpen) {
					event.preventDefault();
				} else {
					closeIfNotEmpty(event);
				}
			}}
		>
			{#snippet child({ props })}
				<div {...props} hidden={!dialogOpen}>
					<Dialog.Title class="note-a11y">{$_('post')}</Dialog.Title>
					<Dialog.Description class="note-a11y"
						>Write a note, reply, or quote before posting.</Dialog.Description
					>
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
							bind:content
							{replyTo}
							{quotes}
							bind:busy={composerBusy}
							onSent={handleSent}
							afterPost={closeDialog}
						/>
					</div>
				</div>
			{/snippet}
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

<style>
	:global(.note-overlay) {
		position: fixed;
		inset: 0;
		z-index: 1000;
		background: rgb(0 0 0 / 40%);
		cursor: default;
	}
	:global(.note-a11y) {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	:global(.note-panel) {
		position: fixed;
		left: 50%;
		z-index: 1001;
		max-height: calc(100dvh - 2rem);
		cursor: default;
		border: var(--border);
		border-radius: var(--radius);
		max-width: 600px;
		top: 1rem;
		transform: translateX(-50%);
		background: var(--surface);
		color: var(--surface-foreground);
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
		:global(.note-panel) {
			width: 90%;
		}
	}
</style>
