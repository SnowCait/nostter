<script lang="ts">
	import data from '@emoji-mart/data';
	import { onDestroy, tick, untrack } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { kinds as Kind, nip19 } from 'nostr-tools';
	import { complementPosition } from '$lib/styles/Complement';
	import { adjustHeight } from '$lib/styles/Textarea';
	import { rxNostr } from '$lib/timelines/MainTimeline';
	import {
		compose,
		contentWarningTags,
		emojiTags as createEmojiTags,
		hashtags,
		replyTags
	} from '$lib/TextEventComposer';
	import { Content } from '$lib/Content';
	import { filterTags } from '$lib/EventHelper';
	import { metadataStore } from '$lib/cache/Events';
	import { EventItem, Metadata } from '$lib/Items';
	import type * as Nostr from 'nostr-typedef';
	import { RelayList } from '$lib/RelayList';
	import { getOpenNoteDialog } from '$lib/NoteDialogContext';
	import { author, pubkey, rom } from '$lib/stores/Author';
	import { customEmojiTags, findCustomEmojiSetAddress } from '$lib/author/CustomEmojis';
	import { fetchFolloweesMetadata } from '$lib/author/Follow';
	import Note from '../items/Note.svelte';
	import OnelineProfile from '../profile/OnelineProfile.svelte';
	import MediaPicker from '../MediaPicker.svelte';
	import ContentComponent from '../Content.svelte';
	import CustomEmoji from '../content/CustomEmoji.svelte';
	import ContentWarning from './ContentWarning.svelte';
	import EmojiPicker from '$lib/components/EmojiPicker.svelte';
	import type { PickerEmoji } from '$lib/Emoji';
	import ProfileIcon from '../profile/ProfileIcon.svelte';
	import Loading from '$lib/components/Loading.svelte';
	import EnableVia from './EnableVia.svelte';
	import Via from '../Via.svelte';
	import { createViaTag, via } from '$lib/author/Via';
	import { Collapsible } from 'melt/builders';
	import ContinuePosting from './ContinuePosting.svelte';
	import ExternalLink from '../ExternalLink.svelte';
	import { emojiEditorUrl } from '$lib/Constants';
	import {
		appendUrls,
		filesFromDataTransferItems,
		type LocalAttachment
	} from '$lib/media/LocalAttachment';
	import { LocalAttachments } from '$lib/media/LocalAttachments.svelte';
	import MediaAttachments from '../MediaAttachments.svelte';

	export function clear(closed = false): void {
		if (composerLocked) return;
		clearComposer(closed);
	}

	export async function focus(): Promise<void> {
		await tick();
		textarea?.setSelectionRange(0, 0);
		textarea?.focus();
	}

	export function hasAttachments(): boolean {
		return localAttachments.hasAttachments;
	}

	function clearComposer(closed = false): void {
		clearAttachments();
		mention = undefined;
		emojiTags = [];
		contentWarningReason = undefined;

		if (!continuePosting) {
			content = '';
			collapsible.open = false;
		} else {
			const hashtags = Content.findHashtags(content);
			content = ' ' + hashtags.map((hashtag) => `#${hashtag}`).join(' ');
			textarea?.focus();
			tick().then(() => textarea?.setSelectionRange(0, 0));

			if (closed) {
				continuePosting = false;
			}
		}
	}

	interface Props {
		onSent?: () => void;
		afterPost?: () => Promise<void>;
		content?: string;
		replyTo?: EventItem;
		quotes?: Nostr.Event[];
		busy?: boolean;
	}

	let {
		onSent,
		afterPost = async () => {},
		content = $bindable(''),
		replyTo,
		quotes = [],
		// eslint-disable-next-line no-useless-assignment -- $bindable() makes this prop bindable; its initial value is intentionally overwritten.
		busy = $bindable(false)
	}: Props = $props();

	let tags: string[][] = $state([]);
	let posting = $state(false);
	let emojiTags: string[][] = $state([]);
	let continuePosting = $state(false);
	let contentWarningReason: string | undefined = $state();
	let enableVia = $state($via !== 'none');

	let textarea = $state<HTMLTextAreaElement>();

	const collapsible = new Collapsible();

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

	type Emoji = { shortcode: string; url?: string; native?: string };
	type SearchEmoji = { skins: { shortcodes: string; native: string }[] };
	let shortcode = $state<string>();
	let shortcodePrevious = $state<string>();
	let shortcodeComplementList: Emoji[] = $state([]);
	let shortcodeComplementIndex = $state(0);
	let emojiMartInit: Promise<void> | undefined;

	async function initEmojiMart(): Promise<void> {
		const { init } = await import('emoji-kitchen-mart');
		emojiMartInit ??= init({ data }, { caller: 'NoteComposer' });
		return emojiMartInit;
	}

	$effect(() => {
		if (shortcode !== undefined) {
			const query = shortcode;
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
			initEmojiMart()
				.then(async () => {
					const { SearchIndex } = await import('emoji-kitchen-mart');
					return SearchIndex.search(query, { maxResults: 20, caller: 'NoteComposer' });
				})
				.then((emojis) => {
					if (shortcode !== query || !Array.isArray(emojis)) {
						return;
					}

					shortcodeComplementList = [
						...list,
						...emojis.map((emoji: SearchEmoji) => ({
							shortcode: emoji.skins[0].shortcodes,
							native: emoji.skins[0].native
						}))
					];
				});
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

		if (emoji.url !== undefined && !emojiTags.some(([, s]) => s === emoji.shortcode)) {
			const emojiTag = ['emoji', emoji.shortcode, emoji.url];
			const address = findCustomEmojiSetAddress(`:${emoji.shortcode}:`, emoji.url);
			if (address !== undefined) {
				emojiTag.push(address);
			}
			emojiTags.push(emojiTag);
		}

		const { selectionStart } = textarea;
		const index = content.substring(0, selectionStart).lastIndexOf(':');
		const before = content.substring(0, index);
		const after = content.substring(index + ':'.length + shortcode.length);
		content = before + (emoji.native ?? `:${emoji.shortcode}:`) + after;
		const cursor = content.length - after.length;
		await tick();
		textarea.setSelectionRange(cursor, cursor);
		textarea.focus();
		shortcode = undefined;
	}

	//#endregion

	//#region Media

	let onDrag = $state(false);
	const localAttachments = new LocalAttachments();

	let composerLocked = $derived(posting || localAttachments.uploading);
	let localMedia = $derived(
		localAttachments.attachments.map(({ previewUrl: url, kind }) => ({ url, kind }))
	);

	$effect(() => {
		busy = composerLocked;
	});

	onDestroy(() => localAttachments.dispose());

	//#endregion

	let containsNsec = $derived(/nsec1\w{6,}/.test(content));

	$effect(() => {
		createEmojiTags(content, emojiTags).then((emojiTags) => {
			tags = [
				...replyTags(content, $state.snapshot(replyTo?.event)),
				...hashtags(content),
				...emojiTags,
				...contentWarningTags(contentWarningReason)
			];
		});
	});

	const openNoteDialog = getOpenNoteDialog();

	function preventDragDefault(event: DragEvent): void {
		event.preventDefault();
	}

	function clearDragState(event: DragEvent): void {
		event.preventDefault();
		onDrag = false;
	}

	function openDialogOnDragOver(event: DragEvent): void {
		event.preventDefault();
		void openNoteDialog();
	}

	async function onKeydown(e: KeyboardEvent) {
		if (composerLocked) return;
		console.debug(`[composer keydown]`, e.type, e.key, e.ctrlKey, e.metaKey);

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

	async function selectMentionComplement(event: MouseEvent, metadata: Metadata): Promise<void> {
		event.stopPropagation();
		await replaceMentionComplement(metadata);
	}

	async function onEmojiPick(emoji: PickerEmoji): Promise<void> {
		if (composerLocked || textarea === undefined) {
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
	}

	async function selectShortcodeComplement(event: MouseEvent, emoji: Emoji): Promise<void> {
		event.stopPropagation();
		await replaceShortcodeComplement(emoji);
	}

	async function postNote() {
		if (posting) {
			return;
		}
		if (
			content === '' &&
			!localAttachments.hasAttachments &&
			!confirm($_('editor.post.empty'))
		) {
			return;
		}
		if (containsNsec && !confirm($_('editor.post.nsec'))) {
			return;
		}
		const replyTarget = replyTo;
		const replyEvent = $state.snapshot(replyTarget?.event);
		posting = true;
		const contentTarget = content;
		const uploadedUrls = await localAttachments.upload();
		if (uploadedUrls === undefined) {
			posting = false;
			return;
		}
		const finalContent = appendUrls(contentTarget, uploadedUrls);

		const event = await compose(
			replyEvent?.kind === Kind.ChannelMessage ? Kind.ChannelMessage : Kind.ShortTextNote,
			Content.replaceNip19(finalContent),
			[
				...replyTags(finalContent, replyEvent),
				...hashtags(finalContent),
				...(await createEmojiTags(finalContent, $state.snapshot(emojiTags))),
				...contentWarningTags(contentWarningReason),
				...(enableVia ? [createViaTag()] : [])
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
					clearComposer();
					onSent?.();
					if (!continuePosting) {
						await afterPost();
					}
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

		if (replyEvent === undefined) {
			return;
		}

		RelayList.fetchEvents(filterTags('p', replyEvent.tags).filter((p) => p !== $pubkey)).then(
			(relayListEventsMap) => {
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
			}
		);
	}

	async function paste(event: ClipboardEvent) {
		console.log('[paste]', event.type, event.clipboardData);

		if (composerLocked || event.clipboardData === null) {
			return;
		}

		const files = filesFromDataTransferItems(event.clipboardData.items);
		addAttachments(files);
	}

	function dragover(event: DragEvent): void {
		event.preventDefault();
		console.log('[dragover]');
		onDrag = true;
	}

	async function drop(event: DragEvent) {
		console.log('[drop]', event.type, event.dataTransfer);
		event.preventDefault();

		if (composerLocked || event.dataTransfer === null) {
			return;
		}

		const files = filesFromDataTransferItems(event.dataTransfer.items);
		addAttachments(files);
	}

	function mediaPicked({ detail: files }: { detail: FileList }): void {
		console.log('[media picked]', files);
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

	function clearAttachments(): void {
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
		clearAttachments();
	}
</script>

<svelte:body
	ondragstart={preventDragDefault}
	ondragend={clearDragState}
	ondragover={openDialogOnDragOver}
	ondrop={clearDragState}
	ondragleave={clearDragState}
/>

<article class="note-composer" inert={composerLocked} aria-busy={composerLocked}>
	{#if replyTo}
		<article class="reply-to">
			<Note item={replyTo} readonly={true} full={true} />
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
				readonly={composerLocked}
				onkeydown={onKeydown}
				oninput={onInput}
				onpaste={paste}
				ondragover={dragover}
				ondrop={drop}></textarea>
			{#if containsNsec}
				<div class="warning">{$_('editor.warning.nsec')}</div>
			{/if}

			{#if mentionComplementList.length > 0 && textarea !== undefined}
				<ul class="complement card" use:complementPosition={textarea}>
					{#each mentionComplementList as metadata, i}
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
						<li
							class="mention-complement"
							class:selected={i === mentionComplementIndex}
							onclick={async (event) =>
								await selectMentionComplement(event, mentionComplementList[i])}
						>
							<span class="mention-profile">
								<OnelineProfile pubkey={metadata.event.pubkey} />
							</span>
							{#if metadata.normalizedNip05 && metadata.normalizedNip05 !== metadata.displayName}
								<span class="mention-nip05">{metadata.normalizedNip05}</span>
							{/if}
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
							onclick={async (event) =>
								await selectShortcodeComplement(event, shortcodeComplementList[i])}
						>
							{#if emoji.url !== undefined}
								<CustomEmoji text={emoji.shortcode} url={emoji.url} />
								<span>:{emoji.shortcode}:</span>
							{:else}
								<span class="emoji">{emoji.native}</span>
								<span>{emoji.shortcode}</span>
							{/if}
						</li>
					{/each}
					<li class="add-custom-emojis">
						<ExternalLink link={new URL(emojiEditorUrl)}>
							{$_('preferences.emoji.custom')}
						</ExternalLink>
					</li>
				</ul>
			{/if}
		</div>
	</div>

	<MediaAttachments
		attachments={localAttachments.attachments}
		disabled={composerLocked}
		onRetry={retryAttachment}
		onRemove={removeAttachment}
		onAddUrls={addAttachmentUrls}
	/>

	<div class="actions">
		<div class="options">
			<MediaPicker multiple={true} disabled={composerLocked} on:pick={mediaPicked} />
			<EmojiPicker
				containsDefaultEmoji={false}
				autoClose={false}
				inComposer={true}
				onPick={onEmojiPick}
			/>
			<button class="clear composer-option advanced" {...collapsible.trigger}>
				{$_('editor.options.advanced')}
			</button>
		</div>
		<div>
			<button
				title="{$_('editor.post.button')} (Ctrl + Enter)"
				class="active"
				onclick={postNote}
				disabled={$author === undefined ||
					(content === '' && !localAttachments.hasAttachments) ||
					$rom ||
					posting ||
					localAttachments.uploading}
			>
				{$_('editor.post.button')}
			</button>
		</div>
	</div>
	{#if collapsible.open}
		<div class="advanced-options" {...collapsible.content}>
			<ContinuePosting bind:continuePosting />
			<ContentWarning bind:reason={contentWarningReason} />
			<EnableVia bind:enable={enableVia} />
		</div>
	{/if}
	{#if quotes.length > 0}
		{#each quotes as quote}
			<Note item={new EventItem(quote)} readonly={true} />
		{/each}
	{/if}
	{#if localAttachments.uploading}
		<div class="uploading">
			<Loading />
		</div>
	{/if}
	{#if content !== '' || localAttachments.hasAttachments}
		<section class="preview card">
			<ContentComponent content={Content.replaceNip19(content)} {tags} {localMedia} />
			{#if enableVia}
				<div>
					<Via tags={[createViaTag()]} />
				</div>
			{/if}
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

	button {
		padding: 0.4rem 1rem;
		user-select: none;
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
		align-items: center;
	}

	.options .advanced {
		color: var(--accent);
		background-color: inherit;
		height: 36px;
		width: inherit;
		padding: 0 8px;
	}

	.advanced-options {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1rem;
	}

	.uploading {
		text-align: center;
		padding-bottom: 0.7em;
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

	ul.complement li.mention-complement {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		min-width: 0;
	}

	.mention-profile,
	.mention-nip05 {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.mention-profile {
		flex: 1;
		min-width: 0;
	}

	.mention-nip05 {
		color: var(--accent-gray);
		font-size: 0.8rem;
		max-width: 50%;
	}

	ul.complement li.add-custom-emojis {
		text-align: center;
	}

	:global(.options > *) {
		height: inherit;
	}
</style>
