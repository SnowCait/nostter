<script lang="ts">
	import { createBubbler, preventDefault, stopPropagation } from 'svelte/legacy';

	const bubble = createBubbler();
	import { createEventDispatcher, tick, untrack } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { kinds as Kind, nip19, type Event as NostrEvent } from 'nostr-tools';
	import { uploadFiles } from '$lib/media/FileStorageServer';
	import { complementPosition } from '$lib/styles/Complement';
	import { adjustHeight } from '$lib/styles/Textarea';
	import { getSeenOnRelays, rxNostr } from '$lib/timelines/MainTimeline';
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
	import IconMoodSmile from '@tabler/icons-svelte/icons/mood-smile';
	import Loading from '$lib/components/Loading.svelte';
	import { SvelteMap } from 'svelte/reactivity';

	export function clear(): void {
		console.log('[note editor clear]');
		$openNoteDialog = false;
		content = '';
		$intentContent = '';
		$replyTo = undefined;
		$quotes = [];
		mention = undefined;
		emojiTags = [];
		contentWarningReason = undefined;
	}

	interface Props {
		afterPost?: () => Promise<void>;
		content?: string;
	}

	let { afterPost = async () => {}, content = $bindable('') }: Props = $props();

	let tags: string[][] = $state([]);
	let posting = $state(false);
	let channelEvent: NostrEvent | undefined = $state();
	let emojiTags: string[][] = $state([]);
	let contentWarningReason: string | undefined = $state();

	let textarea = $state<HTMLTextAreaElement>();

	//#region Mention complement

	let mention = $state<string>();
	let mentionPrevious = $state<string>();
	let mentionComplementList: Metadata[] = $state([]);
	let mentionComplementIndex = $state(0);

	$effect(() => {
		if (mention !== undefined) {
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
							(metadata) =>
								!list.some((m) => m.event.pubkey === metadata.event.pubkey)
						)
						.slice(0, displayMax - list.length)
				);
			}
			if (list.length < displayMax) {
				fetchFolloweesMetadata();
			}
			mentionComplementList = list;
			console.debug('[complement mention list]', mention, list);
		}
	});

	$effect(() => {
		if (mention === undefined) {
			mentionComplementList = [];
		}
	});

	$effect(() => {
		if (mention !== mentionPrevious) {
			untrack(() => {
				mentionPrevious = mention;
				mentionComplementIndex = 0;
			});
		}
	});

	//#endregion

	//#region Custom Emoji

	type Emoji = { shortcode: string; url: string };
	let shortcode = $state<string>();
	let shortcodePrevious = $state<string>();
	let shortcodeComplementList: Emoji[] = $state([]);
	let shortcodeComplementIndex = $state(0);

	$effect(() => {
		if (shortcode !== undefined) {
			const customEmojiList = $customEmojiTags.map(([, shortcode, url]) => ({
				shortcode,
				url
			}));
			const list = customEmojiList.filter(({ shortcode: s }) =>
				s.toLowerCase().startsWith((shortcode ?? '').toLowerCase())
			);
			list.push(
				...customEmojiList.filter(({ shortcode: s }) =>
					s.toLowerCase().includes((shortcode ?? '').toLowerCase())
				)
			);
			shortcodeComplementList = list;
			console.debug('[complement shortcode list]', shortcode, list);
		}
	});

	$effect(() => {
		if (shortcode === undefined) {
			shortcodeComplementList = [];
		}
	});

	$effect(() => {
		if (shortcode !== shortcodePrevious) {
			untrack(() => {
				shortcodePrevious = shortcode;
				shortcodeComplementIndex = 0;
			});
		}
	});

	async function replaceShortcodeComplement(emoji: Emoji): Promise<void> {
		if (shortcode === undefined || textarea === undefined) {
			return;
		}

		console.debug('[complement shortcode replace]', emoji);

		if (!emojiTags.some(([, s]) => s === emoji.shortcode)) {
			emojiTags.push(['emoji', emoji.shortcode, emoji.url]);
		}

		const { selectionStart } = textarea;
		const index = content.substring(0, selectionStart).lastIndexOf(':');
		const before = content.substring(0, index);
		const after = content.substring(index + ':'.length + shortcode.length);
		content = before + ':' + emoji.shortcode + ':' + after;
		const cursor = content.length - after.length;
		await tick();
		textarea.setSelectionRange(cursor, cursor);
		textarea.focus();
		shortcode = undefined;
	}

	//#endregion

	//#region Media

	let onDrag = $state(false);
	let mediaUrls = new SvelteMap<File, string | undefined>();

	let uploading = $derived([...mediaUrls].some(([, url]) => url === undefined));

	//#endregion

	let containsNsec = $derived(/nsec1\w{6,}/.test(content));

	$effect(() => {
		const noteComposer = new NoteComposer();
		noteComposer.emojiTags(content, emojiTags).then((emojiTags) => {
			tags = [
				...noteComposer.replyTags(content, $replyTo, $channelIdStore),
				...noteComposer.hashtags(content),
				...emojiTags,
				...noteComposer.contentWarningTags(contentWarningReason)
			];
		});
	});

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

			await tick();
			if (textarea === undefined) {
				return;
			}
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
					replaceMentionComplement(mentionComplementList[mentionComplementIndex]);
				}
				if (shortcode !== undefined) {
					replaceShortcodeComplement(shortcodeComplementList[shortcodeComplementIndex]);
				}
				break;
			}
		}
	}

	async function onInput(inputEvent: Event) {
		if (textarea === undefined) {
			return;
		}

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

	async function replaceMentionComplement(metadata: Metadata): Promise<void> {
		if (mention === undefined || textarea === undefined) {
			return;
		}

		console.debug('[complement mention replace]', metadata);
		const { selectionStart } = textarea;
		const index = content.substring(0, selectionStart).lastIndexOf('@');
		const before = content.substring(0, index);
		const after = content.substring(index + '@'.length + mention.length);
		content =
			before +
			(before === '' || before.endsWith(' ') ? '' : ' ') +
			'nostr:' +
			nip19.npubEncode(metadata.event.pubkey) +
			(after.startsWith(' ') ? '' : ' ') +
			after;
		const cursor = content.length - after.length + (after.startsWith(' ') ? 1 : 0);
		console.debug('[complement]', after, content.length, cursor);
		await tick();
		textarea.setSelectionRange(cursor, cursor);
		textarea.focus();
		mention = undefined;
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	async function onEmojiPick({ detail: emoji }: { detail: any }): Promise<void> {
		if (textarea === undefined) {
			return;
		}

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
		}
		await tick();
		const cursor = content.length - after.length;
		textarea.setSelectionRange(cursor, cursor);
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
				: Kind.ShortTextNote,
			Content.replaceNip19(content),
			[
				...noteComposer.replyTags(content, $replyTo, $channelIdStore),
				...noteComposer.hashtags(content),
				...(await noteComposer.emojiTags(content, $state.snapshot(emojiTags))),
				...noteComposer.contentWarningTags(contentWarningReason)
			]
		);

		if (event === null) {
			posting = false;
			return;
		}

		console.log('[rx-nostr send to]', rxNostr.getAllRelayStatus());
		const sendToRelays = Object.entries(rxNostr.getDefaultRelays())
			.filter(([, { write }]) => write)
			.map(([url]) => url);
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

		const urls = await uploadFiles(files);

		for (const { file, url } of urls) {
			mediaUrls.set(file, url);
		}

		addUrlsToContent(urls.map(({ url }) => url));

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
	ondragstart={preventDefault(bubble('dragstart'))}
	ondragend={preventDefault(() => {
		onDrag = false;
	})}
	ondragover={preventDefault(() => {
		if (!$openNoteDialog) {
			$openNoteDialog = true;
		}
	})}
	ondrop={preventDefault(() => {
		onDrag = false;
	})}
	ondragleave={preventDefault(() => {
		onDrag = false;
	})}
/>

<article class="note-editor">
	{#if channelEvent !== undefined}
		<ChannelTitle channelMetadata={Channel.parseMetadata(channelEvent)} />
	{/if}
	{#if $replyTo}
		<article class="reply-to">
			<Note item={$replyTo} readonly={true} full={true} />
		</article>
	{/if}
	<div class="content">
		<div>
			<ProfileIcon pubkey={$pubkey} width="40px" height="40px" />
		</div>
		<div class="input">
			<textarea
				placeholder={$_('editor.content.placeholder')}
				class:dropzone={onDrag}
				bind:value={content}
				bind:this={textarea}
				onkeydown={onKeydown}
				oninput={onInput}
				onpaste={paste}
				ondragover={preventDefault(dragover)}
				ondrop={drop}
			></textarea>
			{#if containsNsec}
				<div class="warning">{$_('editor.warning.nsec')}</div>
			{/if}

			{#if mentionComplementList.length > 0 && textarea !== undefined}
				<ul class="complement card" use:complementPosition={textarea}>
					{#each mentionComplementList as metadata, i}
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
						<li
							class:selected={i === mentionComplementIndex}
							onclick={stopPropagation(
								async () => await replaceMentionComplement(mentionComplementList[i])
							)}
						>
							<OnelineProfile pubkey={metadata.event.pubkey} />
						</li>
					{/each}
				</ul>
			{/if}

			{#if shortcodeComplementList.length > 0 && textarea !== undefined}
				<ul class="complement card" use:complementPosition={textarea}>
					{#each shortcodeComplementList as emoji, i}
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
						<li
							class:selected={i === shortcodeComplementIndex}
							onclick={stopPropagation(
								async () =>
									await replaceShortcodeComplement(shortcodeComplementList[i])
							)}
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
				title="{$_('editor.post.button')} (Ctrl + Enter)"
				class="button-small"
				onclick={postNote}
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
		<div class="uploading">
			<p>Uploading...</p>
			<Loading />
		</div>
	{/if}
	{#if content !== ''}
		<section class="preview card">
			<ContentComponent content={Content.replaceNip19(content)} {tags} />
		</section>
	{/if}
</article>

<style>
	.reply-to {
		max-height: 10rem;
		overflow-y: auto;
	}

	.content {
		display: flex;
		flex-direction: row;
		gap: 0.5rem;
		margin: 0.5rem 1rem;
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
		resize: none;
	}

	div.warning {
		font-size: 0.75rem;
		color: var(--red);
		margin: 0.25rem auto;
	}

	.dropzone {
		background-image:
			linear-gradient(to right, #000, #000 3px, transparent 3px, transparent 8px),
			linear-gradient(to bottom, #000, #000 3px, transparent 3px, transparent 8px),
			linear-gradient(to left, #000, #000 3px, transparent 3px, transparent 8px),
			linear-gradient(to top, #000, #000 3px, transparent 3px, transparent 8px);
		background-size:
			8px 2px,
			2px 8px,
			8px 2px,
			2px 8px;
		background-position:
			left top,
			right top,
			right bottom,
			left bottom;
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

	.uploading {
		text-align: center;
		padding-bottom: 0.7em;
	}

	.uploading p {
		padding-bottom: 0.6em;
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
