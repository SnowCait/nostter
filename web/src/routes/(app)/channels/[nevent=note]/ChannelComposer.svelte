<script lang="ts">
	import { onDestroy, onMount, tick } from 'svelte';
	import type { Event } from 'nostr-tools';
	import { npubEncode } from 'nostr-tools/nip19';
	import { ChannelMessage } from 'nostr-tools/kinds';
	import { _ } from 'svelte-i18n';
	import { IconSend, IconX } from '@tabler/icons-svelte-runes';
	import {
		compose,
		emojiTags as createEmojiTags,
		hashtags,
		replyTags
	} from '$lib/TextEventComposer';
	import { Content } from '$lib/Content';
	import { rxNostr } from '$lib/timelines/MainTimeline';
	import { findCustomEmojiSetAddress } from '$lib/author/CustomEmojis';
	import { metadataStore } from '$lib/cache/Events';
	import { alternativeName } from '$lib/Items';
	import EmojiPicker from '$lib/components/EmojiPicker.svelte';
	import type { PickerEmoji } from '$lib/Emoji';
	import MediaPicker from '$lib/components/MediaPicker.svelte';
	import MediaAttachments from '$lib/components/MediaAttachments.svelte';
	import {
		appendUrls,
		filesFromDataTransferItems,
		type LocalAttachment
	} from '$lib/media/LocalAttachment';
	import { LocalAttachments } from '$lib/media/LocalAttachments.svelte';
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
	const localAttachments = new LocalAttachments();

	let composerLocked = $derived(posting || localAttachments.uploading);
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
		localAttachments.dispose();
	});

	async function send(): Promise<void> {
		if (composerLocked || (content.trim() === '' && !localAttachments.hasAttachments)) {
			return;
		}
		posting = true;
		const contentTarget = content;
		const replyTarget = $state.snapshot(replyTo);
		const emojiTagsTarget = $state.snapshot(emojiTags);
		const uploadedUrls = await localAttachments.upload();
		if (uploadedUrls === undefined) {
			posting = false;
			return;
		}
		const finalContent = appendUrls(contentTarget, uploadedUrls);

		const event = await compose(ChannelMessage, Content.replaceNip19(finalContent), [
			...replyTags(finalContent, replyTarget, channelId),
			...hashtags(finalContent),
			...(await createEmojiTags(finalContent, emojiTagsTarget))
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
		const files = filesFromDataTransferItems(event.clipboardData.items);
		addAttachments(files);
	}

	function drop(event: DragEvent): void {
		event.preventDefault();
		if (composerLocked || event.dataTransfer === null) {
			return;
		}
		const files = filesFromDataTransferItems(event.dataTransfer.items);
		addAttachments(files);
	}

	function mediaPicked({ detail: files }: { detail: FileList }): void {
		addAttachments(files);
	}

	function addAttachments(files: FileList | File[]): void {
		if (composerLocked) return;
		localAttachments.add(files);
	}

	function removeAttachment(attachment: LocalAttachment): void {
		if (composerLocked) return;
		localAttachments.remove(attachment);
	}

	function clearReply(): void {
		if (composerLocked) return;
		replyTo = undefined;
	}

	function clearComposer(): void {
		content = '';
		emojiTags = [];
		replyTo = undefined;
		localAttachments.clear();
	}

	async function retryAttachment(attachment: LocalAttachment): Promise<void> {
		if (composerLocked) return;
		await localAttachments.retry(attachment);
	}

	async function addAttachmentUrls(): Promise<void> {
		if (composerLocked) return;
		const uploadedUrls = await localAttachments.upload();
		if (uploadedUrls === undefined) return;
		content = appendUrls(content, uploadedUrls);
		localAttachments.clear();
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
	<MediaAttachments
		attachments={localAttachments.attachments}
		disabled={composerLocked}
		onRetry={retryAttachment}
		onRemove={removeAttachment}
		onAddUrls={addAttachmentUrls}
	/>
	<div class="input">
		<MediaPicker multiple={true} disabled={composerLocked} on:pick={mediaPicked} />
		<EmojiPicker inComposer={true} onPick={onEmojiPick} />
		<textarea
			bind:this={textarea}
			bind:value={content}
			readonly={composerLocked}
			rows="1"
			placeholder={$_('channel.placeholder')}
			onkeydown={onKeydown}
			onpaste={paste}
			ondrop={drop}></textarea>
		<button
			class="send"
			title="{$_('channel.send')} (Ctrl + Enter)"
			disabled={composerLocked || (content.trim() === '' && !localAttachments.hasAttachments)}
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

	.input {
		display: flex;
		align-items: center;
		gap: 0.3rem;
	}

	.input :global(button.composer-option) {
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
	}
</style>
