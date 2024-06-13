<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { Kind, nip19, type Event as NostrEvent } from 'nostr-tools';
	import { uploadFiles } from '$lib/media/FileStorageServer';
	import { complementPosition } from '$lib/styles/Complement';
	import { adjustHeight } from '$lib/styles/Textarea';
	import { rxNostr } from '$lib/timelines/MainTimeline';
	import { NoteComposer } from '$lib/NoteComposer';
	import { channelIdStore, Channel } from '$lib/Channel';
	import { Content } from '$lib/Content';
	import { filterTags } from '$lib/EventHelper';
	import { cachedEvents, channelMetadataEventsStore, metadataStore } from '$lib/cache/Events';
	import { EventItem, Metadata } from '$lib/Items';
	import { RelayList } from '$lib/RelayList';
	import { openNoteDialog, replyTo, quotes, intentContent } from '$lib/stores/NoteDialog';
	import { author, pubkey, rom } from '$lib/stores/Author';
	import { customEmojiTags } from '$lib/author/CustomEmojis';
	import { fetchFolloweesMetadata } from '$lib/author/Follow';
	import Note from '../items/Note.svelte';
	import OnelineProfile from '../profile/OnelineProfile.svelte';
	import ChannelTitle from '../ChannelTitle.svelte';
	import MediaPicker from '../MediaPicker.svelte';
	import ContentComponent from '../Content.svelte';
	import CustomEmoji from '../content/CustomEmoji.svelte';
	import ContentWarning from './ContentWarning.svelte';
	import EmojiPicker from '$lib/components/EmojiPicker.svelte';
	import ProfileIcon from '../profile/ProfileIcon.svelte';
	import IconMoodSmile from '@tabler/icons-svelte/dist/svelte/icons/IconMoodSmile.svelte';

	export function clear(): void {
		console.log('[note editor clear]');
		$openNoteDialog = false;
		content = '';
		$intentContent = '';
		pubkeys.clear();
		$replyTo = undefined;
		$quotes = [];
		mention = undefined;
		emojiTags = [];
		contentWarningReason = undefined;
	}

	export let afterPost: () => Promise<void> = async () => {};

	export let content = '';

	let tags: string[][] = [];
	let posting = false;
	let channelEvent: NostrEvent | undefined;
	let emojiTags: string[][] = [];
	let pubkeys = new Set<string>();
	let contentWarningReason: string | undefined;

	let textarea: HTMLTextAreaElement;
	let article: HTMLElement;

	//#region Mention complement

	let mention: string | undefined;
	let mentionPrevious = mention;
	let mentionComplementList: Metadata[] = [];
	let mentionComplementIndex = 0;

	$: if (mention !== undefined) {
		const displayMax = 10;
		const metadataList = [...$metadataStore].map(([, metadata]) => metadata);
		const list = metadataList
			.filter((metadata) => metadata.startsWith(mention ?? ''))
			.slice(0, displayMax);
		if (list.length < displayMax) {
			list.push(
				...metadataList
					.filter((metadata) => metadata.includes(mention ?? ''))
					.filter(
						(metadata) => !list.some((m) => m.event.pubkey === metadata.event.pubkey)
					)
					.slice(0, displayMax - list.length)
			);
		}
		if (list.length < displayMax) {
			fetchFolloweesMetadata();
		}
		mentionComplementList = list;
		console.debug('[complement mention list]', mention, mentionComplementList);
	}

	$: if (mention === undefined) {
		mentionComplementList = [];
	}

	$: if (mention !== mentionPrevious) {
		mentionPrevious = mention;
		mentionComplementIndex = 0;
	}

	//#endregion

	//#region Custom Emoji

	type Emoji = { shortcode: string; url: string };
	let shortcode: string | undefined;
	let shortcodePrevious = shortcode;
	let shortcodeComplementList: Emoji[] = [];
	let shortcodeComplementIndex = 0;

	$: if (shortcode !== undefined) {
		const customEmojiList = $customEmojiTags.map(([, shortcode, url]) => ({ shortcode, url }));
		const list = customEmojiList.filter(({ shortcode: s }) =>
			s.toLowerCase().startsWith((shortcode ?? '').toLowerCase())
		);
		list.push(
			...customEmojiList.filter(({ shortcode: s }) =>
				s.toLowerCase().includes((shortcode ?? '').toLowerCase())
			)
		);
		shortcodeComplementList = list;
		console.debug('[complement shortcode list]', shortcode, shortcodeComplementList);
	}

	$: if (shortcode === undefined) {
		shortcodeComplementList = [];
	}

	$: if (shortcode !== shortcodePrevious) {
		shortcodePrevious = shortcode;
		shortcodeComplementIndex = 0;
	}

	function replaceShortcodeComplement(emoji: Emoji) {
		if (shortcode === undefined || emojiTags.some(([, s]) => s === emoji.shortcode)) {
			return;
		}

		console.debug('[complement shortcode replace]', emoji);
		const { selectionStart } = textarea;
		const before = content.substring(0, selectionStart - ':'.length - shortcode.length);
		const after = content.substring(selectionStart);
		content = before + ':' + emoji.shortcode + ':' + after;
		const cursor = content.length - after.length;
		textarea.setSelectionRange(cursor, cursor);
		textarea.focus();
		shortcode = undefined;
		emojiTags.push(['emoji', emoji.shortcode, emoji.url]);
	}

	//#endregion

	//#region Media

	let onDrag = false;
	let mediaUrls = new Map<File, string | undefined>();

	$: uploading = [...mediaUrls].some(([, url]) => url === undefined);

	//#endregion

	$: metadata = $metadataStore.get($pubkey);
	$: containsNsec = /nsec1\w{6,}/.test(content);

	$: {
		const noteComposer = new NoteComposer();
		noteComposer.emojiTags(content, emojiTags).then((emojiTags) => {
			tags = [
				...noteComposer.replyTags(content, $replyTo, $channelIdStore, pubkeys),
				...noteComposer.hashtags(content),
				...emojiTags,
				...noteComposer.contentWarningTags(contentWarningReason)
			];
		});
	}

	const dispatch = createEventDispatcher();

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
					'\n' +
					$quotes
						.map((event) => `nostr:${nip19.neventEncode({ id: event.id })}`)
						.join('\n');
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

	async function onKeydown(e: KeyboardEvent) {
		console.debug(`[editor keydown]`, e.type, e.key, e.ctrlKey, e.metaKey);

		// Submit
		if (mention === undefined && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
			await postNote();
		}

		// Complement
		if (
			!(mention !== undefined && mentionComplementList.length > 0) &&
			!(shortcode !== undefined && shortcodeComplementList.length > 0)
		) {
			return;
		}

		switch (e.key) {
			case 'ArrowUp': {
				e.preventDefault();
				if (mention !== undefined && mentionComplementIndex > 0) {
					mentionComplementIndex--;
				}
				if (shortcode !== undefined && shortcodeComplementIndex > 0) {
					shortcodeComplementIndex--;
				}
				break;
			}
			case 'ArrowDown': {
				e.preventDefault();
				if (
					mention !== undefined &&
					mentionComplementIndex < mentionComplementList.length - 1
				) {
					mentionComplementIndex++;
				}
				if (
					shortcode !== undefined &&
					shortcodeComplementIndex < shortcodeComplementList.length - 1
				) {
					shortcodeComplementIndex++;
				}
				break;
			}
			case 'Tab':
			case 'Enter': {
				e.preventDefault();
				if (mention !== undefined) {
					replaceComplement(mentionComplementList[mentionComplementIndex]);
				}
				if (shortcode !== undefined) {
					replaceShortcodeComplement(shortcodeComplementList[shortcodeComplementIndex]);
				}
				break;
			}
		}
	}

	async function onInput(inputEvent: Event) {
		const { selectionStart, selectionEnd } = textarea;
		console.debug('[complement input]', inputEvent, content, selectionStart, selectionEnd);
		if (!(inputEvent instanceof InputEvent)) {
			console.warn('[complement input type]', typeof inputEvent);
			return;
		}

		adjustHeight(textarea);

		// Mention complement
		const mentionMatches = textarea.value.matchAll(/(?<=@)\S+/g);
		mention = [...mentionMatches].find(
			({ index, 0: mention }) =>
				index <= selectionStart && selectionStart <= index + mention.length
		)?.[0];

		// Mention complement
		const shortcodeMatches = textarea.value.matchAll(/(?<=:)[^\s:]+/g);
		shortcode = [...shortcodeMatches].find(
			({ index, 0: mention }) =>
				index <= selectionStart && selectionStart <= index + mention.length
		)?.[0];
	}

	function replaceComplement(metadata: Metadata): void {
		if (mention === undefined) {
			return;
		}

		console.debug('[complement mention replace]', metadata);
		const { selectionStart } = textarea;
		const before = content.substring(0, selectionStart - '@'.length - mention.length);
		const after = content.substring(selectionStart);
		content = before + 'nostr:' + nip19.npubEncode(metadata.event.pubkey) + ' ' + after;
		const cursor = content.length - after.length;
		textarea.setSelectionRange(cursor, cursor);
		textarea.focus();
		mention = undefined;
	}

	function onEmojiPick({ detail: emoji }: { detail: any }) {
		console.debug('[emoji pick]', emoji);
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
				...(await noteComposer.emojiTags(content, emojiTags)),
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
				if (packet.ok && posting) {
					posting = false;
					clear();
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

		const files = [...event.clipboardData.items]
			.filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
			.map((item) => item.getAsFile())
			.filter((file): file is File => file !== null);
		await upload(files);
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

		const files = [...event.dataTransfer.items]
			.filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
			.map((item) => item.getAsFile())
			.filter((file): file is File => file !== null);
		await upload(files);
	}

	async function mediaPicked({ detail: files }: { detail: FileList }): Promise<void> {
		console.log('[media picked]', files);
		await upload(files);
	}

	async function upload(files: FileList | File[]): Promise<void> {
		if (files.length === 0) {
			return;
		}

		for (const file of files) {
			mediaUrls.set(file, undefined);
		}
		mediaUrls = mediaUrls;

		const urls = await uploadFiles(files);

		for (const [i, file] of Object.entries(files)) {
			mediaUrls.set(file, urls[Number(i)]);
		}
		mediaUrls = mediaUrls;

		addUrlsToContent(urls);

		if (urls.some((url) => url === undefined)) {
			alert($_('media.upload.failed'));
		}
	}

	function addUrlsToContent(urlsWithUndefined: (string | undefined)[]): void {
		const urls = urlsWithUndefined.filter((url): url is string => url !== undefined);
		if (urls.length === 0) {
			return;
		}
		content += (content === '' ? '' : '\n') + urls.join('\n');
	}
</script>

<svelte:body
	on:dragstart|preventDefault
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

<article bind:this={article} class="note-editor">
	{#if channelEvent !== undefined}
		<ChannelTitle channelMetadata={Channel.parseMetadata(channelEvent)} />
	{/if}
	{#if $replyTo}
		<Note item={$replyTo} readonly={true} />
	{/if}
	<div class="content">
		{#if metadata !== undefined}
			<div class="author">
				<ProfileIcon {metadata} />
			</div>
		{/if}
		<div class="input">
			<textarea
				placeholder={$_('editor.content.placeholder')}
				class:dropzone={onDrag}
				bind:value={content}
				bind:this={textarea}
				on:keydown={onKeydown}
				on:keyup|stopPropagation={() => console.debug}
				on:input={onInput}
				on:paste={paste}
				on:dragover|preventDefault={dragover}
				on:drop|preventDefault={drop}
			/>
			{#if containsNsec}
				<div class="warning">{$_('editor.warning.nsec')}</div>
			{/if}

			{#if mentionComplementList.length > 0 && textarea !== undefined}
				<ul class="complement card" use:complementPosition={textarea}>
					{#each mentionComplementList as metadata, i}
						<!-- svelte-ignore a11y-click-events-have-key-events -->
						<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
						<li
							class:selected={i === mentionComplementIndex}
							on:click|stopPropagation={() =>
								replaceComplement(mentionComplementList[i])}
						>
							<OnelineProfile pubkey={metadata.event.pubkey} />
						</li>
					{/each}
				</ul>
			{/if}

			{#if shortcodeComplementList.length > 0 && textarea !== undefined}
				<ul class="complement card" use:complementPosition={textarea}>
					{#each shortcodeComplementList as emoji, i}
						<!-- svelte-ignore a11y-click-events-have-key-events -->
						<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
						<li
							class:selected={i === shortcodeComplementIndex}
							on:click|stopPropagation={() =>
								replaceComplement(mentionComplementList[i])}
						>
							<CustomEmoji text={emoji.shortcode} url={emoji.url} />
							<span>:{emoji.shortcode}:</span>
						</li>
					{/each}
					<li class="add-custom-emojis">
						<a href="https://emojito.meme/" target="_blank" rel="noopener noreferrer">
							Add custom emojis
						</a>
					</li>
				</ul>
			{/if}
		</div>
	</div>

	<div class="actions">
		<div class="options">
			<MediaPicker multiple={true} on:pick={mediaPicked} />
			<EmojiPicker containsDefaultEmoji={false} autoClose={false} on:pick={onEmojiPick}>
				<span class="emoji-picker">
					<IconMoodSmile size={30} />
				</span>
			</EmojiPicker>
			<ContentWarning bind:reason={contentWarningReason} />
		</div>
		<div>
			<button
				class="button-small"
				on:click={postNote}
				disabled={$author === undefined || content === '' || $rom || posting || uploading}
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
	{#if uploading}
		<div>Uploading...</div>
	{/if}
	{#if content !== ''}
		<section class="preview card">
			<ContentComponent content={Content.replaceNip19(content)} {tags} />
		</section>
	{/if}
</article>

<style>
	.content {
		display: flex;
		flex-direction: row;
	}

	.author {
		width: 3rem;
		height: 3rem;
		margin: 0 0.5rem;
	}

	.input {
		width: 100%;
	}

	textarea {
		width: 100%;
		padding: 0.25rem 0.5rem;
		font-size: 1rem;
		min-height: 5.5rem;
		max-height: 20.5rem;
		line-height: 1rem;
	}

	div.warning {
		font-size: 0.75rem;
		color: var(--red);
		margin: 0.25rem auto;
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

	.preview {
		margin: 1rem;
		max-height: 30rem;
		overflow-y: auto;
	}

	.options {
		display: flex;
		height: 30px;
	}

	.emoji-picker {
		color: var(--accent);
	}

	ul.complement {
		list-style: none;
		margin: 0.5rem 1rem;
		padding: 0.5rem 0;
		position: fixed;
	}

	ul.complement li {
		padding: 0.3rem;
	}

	ul.complement li.selected {
		border: solid 1px var(--accent-surface);
		background-color: var(--accent-foreground);
	}

	ul.complement li.add-custom-emojis {
		text-align: center;
	}

	:global(.options > *) {
		height: inherit;
	}
</style>
