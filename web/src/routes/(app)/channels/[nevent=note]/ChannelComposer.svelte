<script lang="ts">
	import { onDestroy, onMount, tick } from 'svelte';
	import type { Event } from 'nostr-tools';
	import { npubEncode } from 'nostr-tools/nip19';
	import { ChannelMessage } from 'nostr-tools/kinds';
	import { _ } from 'svelte-i18n';
	import { IconSend, IconTrash, IconX } from '@tabler/icons-svelte-runes';
	import { NoteComposer } from '$lib/NoteComposer';
	import { Content } from '$lib/Content';
	import { rxNostr } from '$lib/timelines/MainTimeline';
	import { findCustomEmojiSetAddress } from '$lib/author/CustomEmojis';
	import { metadataStore } from '$lib/cache/Events';
	import { alternativeName } from '$lib/Items';
	import EmojiPicker from '$lib/components/EmojiPicker.svelte';
	import type { PickerEmoji } from '$lib/Emoji';
	import MediaPicker from '$lib/components/MediaPicker.svelte';
	import LocalMedia from '$lib/components/content/LocalMedia.svelte';
	import {
		appendUrls,
		createLocalAttachments,
		revokeAttachments,
		uploadLocalAttachments,
		type LocalAttachment
	} from '$lib/media/LocalAttachment';
	import { composerFocus } from './ComposerFocus.svelte';

	interface Props {
		channelId: string;
		replyTo?: Event;
	}

	let { channelId, replyTo = $bindable() }: Props = $props();

	let textarea = $state<HTMLTextAreaElement>();
	let content = $state('');
	let posting = $state(false);
	let emojiTags = $state<string[][]>([]);
	let attachments: LocalAttachment[] = $state([]);

	let uploading = $derived(attachments.some(({ state }) => state === 'uploading'));
	let composerLocked = $derived(posting || uploading);
	let replyName = $derived(
		replyTo !== undefined
			? ($metadataStore.get(replyTo.pubkey)?.displayName ?? alternativeName(replyTo.pubkey))
			: ''
	);

	onMount(() => {
		composerFocus.current = () => textarea?.focus();
	});

	onDestroy(() => {
		composerFocus.current = undefined;
		revokeAttachments(attachments);
	});

	async function send(): Promise<void> {
		if (composerLocked || (content.trim() === '' && attachments.length === 0)) {
			return;
		}
		posting = true;
		const contentTarget = content;
		const replyTarget = $state.snapshot(replyTo);
		const emojiTagsTarget = $state.snapshot(emojiTags);
		const attachmentTarget = [...attachments];
		const uploadedUrls = await uploadLocalAttachments(attachmentTarget);
		if (uploadedUrls === undefined) {
			posting = false;
			return;
		}
		const finalContent = appendUrls(contentTarget, uploadedUrls);

		const composer = new NoteComposer();
		const event = await composer.compose(ChannelMessage, Content.replaceNip19(finalContent), [
			...composer.replyTags(finalContent, replyTarget, channelId),
			...composer.hashtags(finalContent),
			...(await composer.emojiTags(finalContent, emojiTagsTarget))
		]);

		if (event === null) {
			posting = false;
			return;
		}

		rxNostr.send(event).subscribe({
			next: (packet) => {
				if (packet.ok && posting) {
					posting = false;
					clearComposer();
				}
			},
			error: (error) => {
				console.error('[channel message send error]', error);
				posting = false;
			}
		});
	}

	function onKeydown(event: KeyboardEvent): void {
		if (composerLocked) return;
		if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.isComposing) {
			event.preventDefault();
			send();
		} else if (event.key === 'Escape' && replyTo !== undefined) {
			event.preventDefault();
			clearReply();
		}
	}

	async function onEmojiPick(emoji: PickerEmoji): Promise<void> {
		if (composerLocked || textarea === undefined) {
			return;
		}
		const shortcode = emoji.id.replaceAll('+', '_');
		const { selectionStart, selectionEnd } = textarea;
		const before = content.substring(0, selectionStart);
		const after = content.substring(selectionEnd);
		content = before + (emoji.native ?? `:${shortcode}:`) + after;
		if (
			emoji.native === undefined &&
			emoji.src !== undefined &&
			!emojiTags.some(([, s]) => s === shortcode)
		) {
			const emojiTag = ['emoji', shortcode, emoji.src];
			const address = findCustomEmojiSetAddress(`:${shortcode}:`, emoji.src);
			if (address !== undefined) {
				emojiTag.push(address);
			}
			emojiTags.push(emojiTag);
		}
		await tick();
		const cursor = content.length - after.length;
		textarea.setSelectionRange(cursor, cursor);
		textarea.focus();
	}

	function paste(event: ClipboardEvent): void {
		if (composerLocked || event.clipboardData === null) {
			return;
		}
		const files = [...event.clipboardData.items]
			.filter((item) => item.kind === 'file')
			.map((item) => item.getAsFile())
			.filter((file): file is File => file !== null);
		addAttachments(files);
	}

	function drop(event: DragEvent): void {
		event.preventDefault();
		if (composerLocked || event.dataTransfer === null) {
			return;
		}
		const files = [...event.dataTransfer.items]
			.filter((item) => item.kind === 'file')
			.map((item) => item.getAsFile())
			.filter((file): file is File => file !== null);
		addAttachments(files);
	}

	function mediaPicked({ detail: files }: { detail: FileList }): void {
		addAttachments(files);
	}

	function addAttachments(files: FileList | File[]): void {
		if (composerLocked) return;
		attachments = [...attachments, ...createLocalAttachments(files)];
	}

	function removeAttachment(attachment: LocalAttachment): void {
		if (composerLocked) return;
		URL.revokeObjectURL(attachment.previewUrl);
		attachments = attachments.filter((candidate) => candidate !== attachment);
	}

	function clearAttachments(): void {
		revokeAttachments(attachments);
		attachments = [];
	}

	function clearReply(): void {
		if (composerLocked) return;
		replyTo = undefined;
	}

	function clearComposer(): void {
		content = '';
		emojiTags = [];
		replyTo = undefined;
		clearAttachments();
	}

	async function retryAttachment(attachment: LocalAttachment): Promise<void> {
		if (composerLocked || attachment.state !== 'failed') return;
		await uploadLocalAttachments([attachment]);
	}

	async function addAttachmentUrls(): Promise<void> {
		if (composerLocked) return;
		const attachmentTarget = [...attachments];
		const uploadedUrls = await uploadLocalAttachments(attachmentTarget);
		if (uploadedUrls === undefined) return;
		content = appendUrls(content, uploadedUrls);
		clearAttachments();
	}
</script>

<div class="composer" inert={composerLocked} aria-busy={composerLocked}>
	{#if replyTo !== undefined}
		<div class="reply">
			<span class="reply-label">
				{$_('channel.reply_to')}
				<a href="/{npubEncode(replyTo.pubkey)}">@{replyName}</a>
			</span>
			<button
				class="clear"
				title="{$_('editor.close.button')} (Esc)"
				disabled={composerLocked}
				onclick={clearReply}
			>
				<IconX size={18} />
			</button>
		</div>
	{/if}
	{#if attachments.length > 0}
		<section class="attachments" aria-label={$_('media.attachments.title')}>
			<ul>
				{#each attachments as attachment}
					<li>
						<div class="attachment-preview">
							<LocalMedia
								media={{ url: attachment.previewUrl, kind: attachment.kind }}
							/>
						</div>
						<div class="attachment-details">
							<span class="attachment-name">{attachment.file.name}</span>
							<span
								class="attachment-state"
								class:failed={attachment.state === 'failed'}
							>
								{$_(`media.attachments.state.${attachment.state}`)}
							</span>
						</div>
						<div class="attachment-actions">
							{#if attachment.state === 'failed'}
								<button
									class="retry-attachment"
									onclick={() => retryAttachment(attachment)}
									disabled={composerLocked}
								>
									{$_('media.attachments.retry')}
								</button>
							{/if}
							<button
								class="remove-attachment"
								onclick={() => removeAttachment(attachment)}
								disabled={composerLocked}
								aria-label={$_('media.attachments.remove')}
								title={$_('media.attachments.remove')}
							>
								<IconTrash size={18} />
							</button>
						</div>
					</li>
				{/each}
			</ul>
			<button class="add-urls" onclick={addAttachmentUrls} disabled={composerLocked}>
				{$_('media.attachments.add_urls')}
			</button>
		</section>
	{/if}
	<div class="input">
		<MediaPicker multiple={true} disabled={composerLocked} on:pick={mediaPicked} />
		<EmojiPicker inEditor={true} onPick={onEmojiPick} />
		<textarea
			bind:this={textarea}
			bind:value={content}
			readonly={composerLocked}
			rows="1"
			placeholder={$_('channel.placeholder')}
			onkeydown={onKeydown}
			onpaste={paste}
			ondrop={drop}
		></textarea>
		<button
			class="send"
			title="{$_('channel.send')} (Ctrl + Enter)"
			disabled={composerLocked || (content.trim() === '' && attachments.length === 0)}
			onclick={send}
		>
			<IconSend size={20} />
		</button>
	</div>
</div>

<style>
	.composer {
		position: sticky;
		bottom: 0;
		width: 100%;
		background: var(--surface);
		color: var(--surface-foreground);
		border-top: var(--default-border);
		padding: 0.5rem;
		z-index: 2;
	}

	.reply {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		font-size: 0.8rem;
		color: var(--accent-gray);
		padding: 0 0.5rem 0.3rem;
	}

	.reply-label {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.reply a {
		color: var(--accent);
	}

	.reply button {
		flex-shrink: 0;
		width: 1.75rem;
		height: 1.75rem;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--accent-gray);
	}

	.attachments {
		padding: 0 0.25rem 0.5rem;
	}

	.attachments ul {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		margin: 0;
		padding: 0;
		list-style: none;
		max-height: min(12rem, 30dvh);
		overflow-y: auto;
		overscroll-behavior: contain;
	}

	.attachments li {
		display: grid;
		grid-template-columns: minmax(4rem, 6rem) minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.5rem;
		padding: 0.25rem;
		border-radius: var(--radius);
		background: var(--accent-surface-low);
	}

	.attachment-preview {
		max-height: 3.5rem;
		overflow: hidden;
	}

	.attachment-preview :global(img),
	.attachment-preview :global(video) {
		min-width: 0;
		max-width: 100%;
		max-height: 3.5rem;
		margin: 0;
	}

	.attachment-preview :global(audio) {
		width: 100%;
		max-width: 100%;
		height: 2.5rem;
	}

	.attachment-details,
	.attachment-actions {
		display: flex;
		gap: 0.35rem;
	}

	.attachment-details {
		flex-direction: column;
		min-width: 0;
	}

	.attachment-actions {
		align-items: center;
		justify-content: flex-end;
	}

	.attachment-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.85rem;
	}

	.attachment-state {
		color: var(--accent-gray);
		font-size: 0.75rem;
	}

	.attachment-state.failed {
		color: var(--red);
		font-weight: bold;
	}

	.retry-attachment {
		padding: 0.3rem 0.6rem;
		border: 1px solid var(--accent-gray);
		background: transparent;
		color: var(--accent-gray);
		font-size: 0.75rem;
	}

	.remove-attachment {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		padding: 0;
		border-radius: 50%;
		background: transparent;
		color: var(--accent-gray);
	}

	.retry-attachment:hover:not(:disabled),
	.remove-attachment:hover:not(:disabled),
	.remove-attachment:focus-visible {
		opacity: 1;
		background: var(--accent-surface-high);
		color: var(--surface-foreground);
	}

	.retry-attachment:focus-visible,
	.remove-attachment:focus-visible,
	.add-urls:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.add-urls {
		display: block;
		width: fit-content;
		margin: 0.25rem 0 0 auto;
		padding: 0.2rem 0.125rem;
		border-radius: 0;
		background: transparent;
		color: var(--accent-gray);
		font-size: 0.75rem;
		font-weight: normal;
		text-decoration: none;
	}

	.add-urls:hover:not(:disabled),
	.add-urls:focus-visible {
		opacity: 1;
		color: var(--surface-foreground);
		text-decoration: underline;
		text-underline-offset: 0.2em;
	}

	.input {
		display: flex;
		align-items: center;
		gap: 0.3rem;
	}

	.input :global(button.editor-option) {
		width: 44px;
		height: 44px;
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	textarea {
		flex: 1;
		min-width: 0;
		resize: none;
		border: var(--default-border);
		border-radius: var(--radius);
		padding: 0.5rem;
		font: inherit;
		font-size: 16px;
		max-height: 8rem;
		field-sizing: content;
	}

	.send {
		flex-shrink: 0;
		width: 44px;
		height: 44px;
		padding: 8px;
		color: var(--accent);
		background: none;
		border: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.send:disabled {
		color: var(--accent-gray);
		cursor: default;
	}

	@media screen and (max-width: 600px) {
		.composer {
			bottom: calc(3.125rem + env(safe-area-inset-bottom));
		}

		.attachments li {
			grid-template-columns: 4rem minmax(0, 1fr) auto;
			gap: 0.35rem;
		}

		.attachments ul {
			max-height: min(10rem, 25dvh);
		}

		.attachment-actions {
			gap: 0.2rem;
		}
	}
</style>
