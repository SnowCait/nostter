<script lang="ts">
	import { onDestroy, onMount, tick } from 'svelte';
	import type { Event } from 'nostr-tools';
	import { npubEncode } from 'nostr-tools/nip19';
	import { ChannelMessage } from 'nostr-tools/kinds';
	import { _ } from 'svelte-i18n';
	import { SvelteMap } from 'svelte/reactivity';
	import { IconSend, IconX } from '@tabler/icons-svelte-runes';
	import { NoteComposer } from '$lib/NoteComposer';
	import { Content } from '$lib/Content';
	import { rxNostr } from '$lib/timelines/MainTimeline';
	import { uploadFiles } from '$lib/media/FileStorageServer';
	import { findCustomEmojiSetAddress } from '$lib/author/CustomEmojis';
	import { metadataStore } from '$lib/cache/Events';
	import { alternativeName } from '$lib/Items';
	import EmojiPicker from '$lib/components/EmojiPicker.svelte';
	import MediaPicker from '$lib/components/MediaPicker.svelte';
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
	let mediaUrls = new SvelteMap<File, string | undefined>();

	let uploading = $derived([...mediaUrls].some(([, url]) => url === undefined));
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
	});

	async function send(): Promise<void> {
		if (posting || uploading || content.trim() === '') {
			return;
		}
		posting = true;

		const composer = new NoteComposer();
		const event = await composer.compose(ChannelMessage, Content.replaceNip19(content), [
			...composer.replyTags(content, $state.snapshot(replyTo), channelId),
			...composer.hashtags(content),
			...(await composer.emojiTags(content, $state.snapshot(emojiTags)))
		]);

		if (event === null) {
			posting = false;
			return;
		}

		rxNostr.send(event).subscribe({
			next: (packet) => {
				if (packet.ok && posting) {
					posting = false;
					content = '';
					emojiTags = [];
					mediaUrls.clear();
					replyTo = undefined;
				}
			},
			error: (error) => {
				console.error('[channel message send error]', error);
				posting = false;
			}
		});
	}

	function onKeydown(event: KeyboardEvent): void {
		if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.isComposing) {
			event.preventDefault();
			send();
		} else if (event.key === 'Escape' && replyTo !== undefined) {
			event.preventDefault();
			replyTo = undefined;
		}
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	async function onEmojiPick({ detail: emoji }: { detail: any }): Promise<void> {
		if (textarea === undefined) {
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

	async function paste(event: ClipboardEvent): Promise<void> {
		if (event.clipboardData === null) {
			return;
		}
		const files = [...event.clipboardData.items]
			.filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
			.map((item) => item.getAsFile())
			.filter((file): file is File => file !== null);
		await upload(files);
	}

	async function drop(event: DragEvent): Promise<void> {
		event.preventDefault();
		if (event.dataTransfer === null) {
			return;
		}
		const files = [...event.dataTransfer.items]
			.filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
			.map((item) => item.getAsFile())
			.filter((file): file is File => file !== null);
		await upload(files);
	}

	async function mediaPicked({ detail: files }: { detail: FileList }): Promise<void> {
		await upload(files);
	}

	async function upload(files: FileList | File[]): Promise<void> {
		if (files.length === 0) {
			return;
		}
		for (const file of files) {
			mediaUrls.set(file, undefined);
		}
		const urls = await uploadFiles(files);
		for (const { file, url } of urls) {
			mediaUrls.set(file, url);
		}
		const uploaded = urls
			.map(({ url }) => url)
			.filter((url): url is string => url !== undefined);
		if (uploaded.length > 0) {
			content += (content === '' ? '' : '\n') + uploaded.join('\n');
		}
		if (urls.some(({ url }) => url === undefined)) {
			alert($_('media.upload.failed'));
		}
	}
</script>

<div class="composer">
	{#if replyTo !== undefined}
		<div class="reply">
			<span class="reply-label">
				{$_('channel.reply_to')}
				<a href="/{npubEncode(replyTo.pubkey)}">@{replyName}</a>
			</span>
			<button
				class="clear"
				title="{$_('editor.close.button')} (Esc)"
				onclick={() => (replyTo = undefined)}
			>
				<IconX size={18} />
			</button>
		</div>
	{/if}
	<div class="input">
		<MediaPicker multiple={true} on:pick={mediaPicked} />
		<EmojiPicker inEditor={true} on:pick={onEmojiPick} />
		<textarea
			bind:this={textarea}
			bind:value={content}
			rows="1"
			placeholder={$_('channel.placeholder')}
			onkeydown={onKeydown}
			onpaste={paste}
			ondrop={drop}
		></textarea>
		<button
			class="send"
			title="{$_('channel.send')} (Ctrl + Enter)"
			disabled={posting || uploading || content.trim() === ''}
			onclick={send}
		>
			<IconSend size={20} />
		</button>
	</div>
	{#if uploading}
		<div class="status">Uploading…</div>
	{/if}
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

	.status {
		font-size: 0.75rem;
		color: var(--accent-gray);
		padding: 0.2rem 0.5rem 0;
	}

	@media screen and (max-width: 600px) {
		.composer {
			bottom: calc(3.125rem + env(safe-area-inset-bottom));
		}
	}
</style>
