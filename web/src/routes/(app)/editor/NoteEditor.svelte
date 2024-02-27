<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import { writable, type Writable } from 'svelte/store';
	import { _ } from 'svelte-i18n';
	import { Kind, nip19, type Event as NostrEvent } from 'nostr-tools';
	import { rxNostr } from '$lib/timelines/MainTimeline';
	import { NoteComposer } from '$lib/NoteComposer';
	import { channelIdStore, Channel } from '$lib/Channel';
	import { Content } from '$lib/Content';
	import { filterTags } from '$lib/EventHelper';
	import { cachedEvents, channelMetadataEventsStore } from '$lib/cache/Events';
	import { EventItem } from '$lib/Items';
	import { RelayList } from '$lib/RelayList';
	import { NostrcheckMe } from '$lib/media/NostrcheckMe';
	import { openNoteDialog, replyTo, quotes, intentContent } from '../../../stores/NoteDialog';
	import { author, pubkey, rom } from '../../../stores/Author';
	import Note from '../timeline/Note.svelte';
	import ChannelTitle from '../parts/ChannelTitle.svelte';
	import MediaPicker from './MediaPicker.svelte';
	import EmojiPickerSlide from './EmojiPickerSlide.svelte';
	import CustomEmoji from '../content/CustomEmoji.svelte';
	import ContentWarning from './ContentWarning.svelte';

	let emojiPickerSlide: EmojiPickerSlide | undefined;

	export function clear(): void {
		console.log('[note editor clear]');
		$openNoteDialog = false;
		content = '';
		$intentContent = '';
		pubkeys.clear();
		$replyTo = undefined;
		$quotes = [];
		emojiTags = [];
		contentWarningReason = undefined;
		emojiPickerSlide?.hide();
		$mediaFiles = [];
	}

	export let afterPost: () => Promise<void> = async () => {};

	let content = '';
	let posting = false;
	let selectedCustomEmojis = new Map<string, string>();
	let channelEvent: NostrEvent | undefined;
	let emojiTags: string[][] = [];
	let pubkeys = new Set<string>();
	let contentWarningReason: string | undefined;
	let mediaFiles: Writable<File[]> = writable([]);

	let textarea: HTMLTextAreaElement;

	let onDrag = false;

	$: containsNsec = /nsec1\w{6,}/.test(content);

	const dispatch = createEventDispatcher();

	mediaFiles.subscribe(async (files: File[]) => {
		if (files.length === 0) {
			return;
		}

		const file = files[files.length - 1];
		console.log('[media file]', file);
		try {
			const media = new NostrcheckMe();
			const { url } = await media.upload(file);
			if (url) {
				content += (content === '' ? '' : '\n') + url;
			}
		} catch (error) {
			console.error('[media upload error]', error);
		}
	});

	channelIdStore.subscribe((channelId) => {
		if (channelId !== undefined) {
			channelEvent =
				$channelMetadataEventsStore.get(channelId) ?? cachedEvents.get(channelId);
		} else {
			channelEvent = undefined;
		}
	});

	// FIXME: Change trigger
	openNoteDialog.subscribe(async (open) => {
		console.log('[open]', open);
		if (open) {
			if ($quotes.length > 0) {
				content =
					'\n' + $quotes.map((event) => `nostr:${nip19.noteEncode(event.id)}`).join('\n');
			}

			await tick();
			console.log(textarea, textarea.selectionStart);
			textarea.setSelectionRange(0, 0);
			textarea.focus();
		}
	});

	intentContent.subscribe((value) => {
		console.log('[content override]');

		content = value;
		value = '';
	});

	async function submitFromKeyboard(event: KeyboardEvent) {
		console.debug(`[${event.type}]`, event.code, event.key, event.ctrlKey, event.metaKey);
		if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
			await postNote();
		}
	}

	function onEmojiPick({ detail: emoji }: { detail: any }) {
		console.log('[emoji pick]', emoji);
		const shortcode = emoji.id.replaceAll('+', '_');
		content += emoji.native ?? `:${shortcode}:`;
		if (
			emoji.native === undefined &&
			emoji.src !== undefined &&
			!emojiTags.some(([, s]) => s === shortcode)
		) {
			emojiTags.push(['emoji', shortcode, emoji.src]);
			emojiTags = emojiTags;
		}
	}

	async function postNote() {
		if (content === '' && !confirm($_('editor.post.empty'))) {
			return;
		}
		if (containsNsec && !confirm($_('editor.post.nsec'))) {
			return;
		}
		posting = true;

		const noteComposer = new NoteComposer();
		const event = await noteComposer.compose(
			$channelIdStore !== undefined || $replyTo?.event?.kind === Kind.ChannelMessage
				? Kind.ChannelMessage
				: Kind.Text,
			Content.replaceNip19(content),
			[
				...noteComposer.replyTags(content, $replyTo, $channelIdStore, pubkeys),
				...noteComposer.hashtags(content),
				...(await noteComposer.emojiTags(content, emojiTags, selectedCustomEmojis)),
				...noteComposer.contentWarningTags(contentWarningReason)
			]
		);

		console.log('[rx-nostr send to]', rxNostr.getAllRelayState());
		const sendToRelays = rxNostr
			.getRelays()
			.filter(({ write }) => write)
			.map(({ url }) => url);
		const sentRelays = new Map<string, boolean>();
		rxNostr.send(event).subscribe({
			next: async (packet) => {
				console.log('[rx-nostr send next]', packet);
				sentRelays.set(packet.from, packet.ok);
				if (packet.ok) {
					posting = false;
					dispatch('sent');
					await afterPost();
				}
			},
			complete: () => {
				console.log('[rx-nostr send complete]');
			},
			error: (error) => {
				console.error(
					'[rx-nostr send error]',
					error,
					sendToRelays.filter((url) => !sentRelays.has(url))
				);
				posting = false;
			}
		});

		if ($replyTo === undefined) {
			return;
		}

		RelayList.fetchEvents(
			filterTags('p', $replyTo.event.tags).filter((p) => p !== $pubkey)
		).then((relayListEventsMap) => {
			if (relayListEventsMap.size === 0) {
				return;
			}

			const readRelays = [...relayListEventsMap]
				.flatMap(([, relayListEvent]) => relayListEvent.tags)
				.filter(
					([tagName, , marker]) =>
						tagName === 'r' && (marker === undefined || marker === 'read')
				)
				.map(([, url]) => url)
				.filter((url) => !sendToRelays.includes(url));
			console.log('[rx-nostr send addition]', readRelays, relayListEventsMap);
			if (readRelays.length === 0) {
				return;
			}
			rxNostr.send(event, { relays: [...new Set(readRelays)] }).subscribe((packet) => {
				console.log('[rx-nostr send additional next]', packet);
			});
		});
	}

	async function paste(event: ClipboardEvent) {
		console.log('[paste]', event.type, event.clipboardData);

		if (event.clipboardData === null) {
			return;
		}

		for (const item of event.clipboardData.items) {
			console.log('[paste file]', item);
			if (item.kind !== 'file' || !item.type.startsWith('image/')) {
				continue;
			}

			const file = item.getAsFile();
			if (file === null) {
				continue;
			}

			$mediaFiles.push(file);
			$mediaFiles = $mediaFiles;
		}
	}

	async function dragover() {
		console.log('[dragover]');
		onDrag = true;
	}

	async function drop(event: DragEvent) {
		console.log('[drop]', event.type, event.dataTransfer);

		if (event.dataTransfer === null) {
			return;
		}

		for (const item of event.dataTransfer.items) {
			console.log('[drop file]', item);
			if (item.kind !== 'file' || !item.type.startsWith('image/')) {
				continue;
			}

			const file = item.getAsFile();
			if (file === null) {
				continue;
			}

			$mediaFiles.push(file);
			$mediaFiles = $mediaFiles;
		}
	}

	async function mediaPicked({ detail: files }: { detail: FileList }): Promise<void> {
		console.log('[media picked]', files);
		if (files.length === 0) {
			return;
		}

		for (const file of files) {
			$mediaFiles.push(file);
			$mediaFiles = $mediaFiles;
		}
	}
</script>

<svelte:body
	on:dragstart|preventDefault={() => console.debug}
	on:dragend|preventDefault={() => {
		onDrag = false;
	}}
	on:dragover|preventDefault={() => {
		if (!$openNoteDialog) {
			$openNoteDialog = true;
		}
	}}
	on:drop|preventDefault={() => {
		onDrag = false;
	}}
	on:dragleave|preventDefault={() => {
		onDrag = false;
	}}
/>

<article class="note-editor">
	{#if channelEvent !== undefined}
		<ChannelTitle channelMetadata={Channel.parseMetadata(channelEvent)} />
	{/if}
	{#if $replyTo}
		<Note item={$replyTo} readonly={true} />
	{/if}
	<textarea
		placeholder={$_('editor.content.placeholder')}
		class:dropzone={onDrag}
		bind:value={content}
		bind:this={textarea}
		on:keydown={submitFromKeyboard}
		on:keyup|stopPropagation={() => console.debug}
		on:paste={paste}
		on:dragover|preventDefault={dragover}
		on:drop|preventDefault={drop}
		class:warning={containsNsec}
	/>
	{#if containsNsec}
		<div class="warning">{$_('editor.warning.nsec')}</div>
	{/if}
	<div class="actions">
		<div class="options">
			<MediaPicker multiple={true} on:pick={mediaPicked} />
			<EmojiPickerSlide bind:this={emojiPickerSlide} on:pick={onEmojiPick} />
			<ContentWarning bind:reason={contentWarningReason} />
		</div>
		<div>
			<button
				class="button-small"
				on:click={postNote}
				disabled={$author === undefined || content === '' || $rom || posting}
			>
				{$_('editor.post.button')}
			</button>
		</div>
	</div>
	{#if $quotes.length > 0}
		{#each $quotes as quote}
			<Note item={new EventItem(quote)} readonly={true} />
		{/each}
	{/if}
	{#if emojiTags.length > 0}
		<ul>
			{#each emojiTags as tag}
				<li>
					<span>:{tag[1]}:</span>
					<CustomEmoji text={tag[1]} url={tag[2]} />
				</li>
			{/each}
		</ul>
	{/if}
	{#if $mediaFiles.length > 0}
		<ul class="media">
			{#each $mediaFiles as file}
				<li>
					<img src={URL.createObjectURL(file)} alt={file.name} />
				</li>
			{/each}
		</ul>
	{/if}
</article>

<style>
	textarea {
		width: 100%;
		padding: 1rem;
	}

	textarea.warning {
		border: 1px solid var(--red);
	}

	div.warning {
		font-size: 0.75rem;
		color: var(--red);
	}

	.dropzone {
		background-image: linear-gradient(
				to right,
				#000,
				#000 3px,
				transparent 3px,
				transparent 8px
			),
			linear-gradient(to bottom, #000, #000 3px, transparent 3px, transparent 8px),
			linear-gradient(to left, #000, #000 3px, transparent 3px, transparent 8px),
			linear-gradient(to top, #000, #000 3px, transparent 3px, transparent 8px);
		background-size: 8px 2px, 2px 8px, 8px 2px, 2px 8px;
		background-position: left top, right top, right bottom, left bottom;
		background-repeat: repeat-x, repeat-y, repeat-x, repeat-y;
	}

	button:disabled {
		color: lightgray;
	}

	.actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem;
		border-top: var(--default-border);
	}

	ul {
		list-style: none;
		padding: 0;
		color: var(--foreground);
	}

	.media img {
		max-height: 200px;
	}

	.options {
		display: flex;
		height: 30px;
	}

	:global(.options > *) {
		height: inherit;
	}
</style>
