<script lang="ts">
	import { createBubbler, preventDefault, stopPropagation } from 'svelte/legacy';

	const bubble = createBubbler();
	import data from '@emoji-mart/data';
	import { createEventDispatcher, onDestroy, tick, untrack } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { kinds as Kind, nip19, type Event as NostrEvent } from 'nostr-tools';
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
	import { customEmojiTags, findCustomEmojiSetAddress } from '$lib/author/CustomEmojis';
	import { fetchFolloweesMetadata } from '$lib/author/Follow';
	import Note from '../items/Note.svelte';
	import OnelineProfile from '../profile/OnelineProfile.svelte';
	import ChannelTitle from '../ChannelTitle.svelte';
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
		createLocalAttachments,
		revokeAttachments,
		uploadLocalAttachments,
		type LocalAttachment
	} from '$lib/media/LocalAttachment';
	import LocalMedia from '../content/LocalMedia.svelte';
	import IconTrash from '@tabler/icons-svelte-runes/icons/trash';

	export function clear(closed = false): void {
		if (editorLocked) return;
		clearEditor(closed);
	}

	function clearEditor(closed = false): void {
		clearAttachments();
		$intentContent = '';
		$replyTo = undefined;
		$quotes = [];
		mention = undefined;
		emojiTags = [];
		contentWarningReason = undefined;

		if (!continuePosting) {
			content = '';
			$openNoteDialog = false;
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
		afterPost?: () => Promise<void>;
		content?: string;
		hasAttachments?: boolean;
		busy?: boolean;
	}

	let {
		afterPost = async () => {},
		content = $bindable(''),
		hasAttachments = $bindable(false),
		busy = $bindable(false)
	}: Props = $props();

	let tags: string[][] = $state([]);
	let posting = $state(false);
	let channelEvent: NostrEvent | undefined = $state();
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
		emojiMartInit ??= init({ data }, { caller: 'NoteEditor' });
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
					return SearchIndex.search(query, { maxResults: 20, caller: 'NoteEditor' });
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
	let attachments: LocalAttachment[] = $state([]);

	let uploading = $derived(attachments.some(({ state }) => state === 'uploading'));
	let editorLocked = $derived(posting || uploading);
	let localMedia = $derived(attachments.map(({ previewUrl: url, kind }) => ({ url, kind })));

	$effect(() => {
		busy = editorLocked;
	});

	onDestroy(() => revokeAttachments(attachments));

	//#endregion

	let containsNsec = $derived(/nsec1\w{6,}/.test(content));

	$effect(() => {
		const noteComposer = new NoteComposer();
		noteComposer.emojiTags(content, emojiTags).then((emojiTags) => {
			tags = [
				...noteComposer.replyTags(
					content,
					$state.snapshot($replyTo?.event),
					$channelIdStore
				),
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
		content = value;
		value = '';
	});

	async function onKeydown(e: KeyboardEvent) {
		if (editorLocked) return;
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

	async function onEmojiPick(emoji: PickerEmoji): Promise<void> {
		if (editorLocked || textarea === undefined) {
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

	async function postNote() {
		if (posting) {
			return;
		}
		if (content === '' && attachments.length === 0 && !confirm($_('editor.post.empty'))) {
			return;
		}
		if (containsNsec && !confirm($_('editor.post.nsec'))) {
			return;
		}
		posting = true;
		const contentTarget = content;
		const uploadTarget = [...attachments];
		const uploadedUrls = await uploadAttachments(uploadTarget);
		if (uploadedUrls === undefined) {
			posting = false;
			return;
		}
		const finalContent = appendUrls(contentTarget, uploadedUrls);

		const noteComposer = new NoteComposer();
		const event = await noteComposer.compose(
			$channelIdStore !== undefined || $replyTo?.event?.kind === Kind.ChannelMessage
				? Kind.ChannelMessage
				: Kind.ShortTextNote,
			Content.replaceNip19(finalContent),
			[
				...noteComposer.replyTags(
					finalContent,
					$state.snapshot($replyTo?.event),
					$channelIdStore
				),
				...noteComposer.hashtags(finalContent),
				...(await noteComposer.emojiTags(finalContent, $state.snapshot(emojiTags))),
				...noteComposer.contentWarningTags(contentWarningReason),
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
					clearEditor();
					if (!continuePosting) {
						dispatch('sent');
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

		if (editorLocked || event.clipboardData === null) {
			return;
		}

		const files = [...event.clipboardData.items]
			.filter((item) => item.kind === 'file')
			.map((item) => item.getAsFile())
			.filter((file): file is File => file !== null);
		addAttachments(files);
	}

	async function dragover() {
		console.log('[dragover]');
		onDrag = true;
	}

	async function drop(event: DragEvent) {
		console.log('[drop]', event.type, event.dataTransfer);
		event.preventDefault();

		if (editorLocked || event.dataTransfer === null) {
			return;
		}

		const files = [...event.dataTransfer.items]
			.filter((item) => item.kind === 'file')
			.map((item) => item.getAsFile())
			.filter((file): file is File => file !== null);
		addAttachments(files);
	}

	function mediaPicked({ detail: files }: { detail: FileList }): void {
		console.log('[media picked]', files);
		addAttachments(files);
	}

	function addAttachments(files: FileList | File[]): void {
		if (editorLocked) return;
		attachments = [...attachments, ...createLocalAttachments(files)];
		hasAttachments = attachments.length > 0;
	}

	function removeAttachment(attachment: LocalAttachment): void {
		if (editorLocked) return;
		URL.revokeObjectURL(attachment.previewUrl);
		attachments = attachments.filter((candidate) => candidate !== attachment);
		hasAttachments = attachments.length > 0;
	}

	function clearAttachments(): void {
		revokeAttachments(attachments);
		attachments = [];
		hasAttachments = false;
	}

	async function uploadAttachments(
		uploadTarget: LocalAttachment[]
	): Promise<string[] | undefined> {
		if (!(await uploadLocalAttachments(uploadTarget))) return undefined;
		const urls: string[] = [];
		for (const attachment of uploadTarget) {
			if (attachment.url === undefined) return undefined;
			urls.push(attachment.url);
		}
		return urls;
	}

	async function retryAttachment(attachment: LocalAttachment): Promise<void> {
		if (editorLocked || attachment.state !== 'failed') return;
		await uploadLocalAttachments([attachment]);
	}

	async function addAttachmentUrls(): Promise<void> {
		if (editorLocked) return;
		const uploadTarget = [...attachments];
		const uploadedUrls = await uploadAttachments(uploadTarget);
		if (uploadedUrls === undefined) return;
		content = appendUrls(content, uploadedUrls);
		clearAttachments();
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

<article class="note-editor" inert={editorLocked} aria-busy={editorLocked}>
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
				readonly={editorLocked}
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
							class="mention-complement"
							class:selected={i === mentionComplementIndex}
							onclick={stopPropagation(
								async () => await replaceMentionComplement(mentionComplementList[i])
							)}
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
							onclick={stopPropagation(
								async () =>
									await replaceShortcodeComplement(shortcodeComplementList[i])
							)}
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

	{#if attachments.length > 0}
		<section class="attachments card" aria-label={$_('media.attachments.title')}>
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
									onclick={() => retryAttachment(attachment)}
									disabled={editorLocked}
								>
									{$_('media.attachments.retry')}
								</button>
							{/if}
							<button
								class="remove-attachment"
								onclick={() => removeAttachment(attachment)}
								disabled={editorLocked}
								aria-label={$_('media.attachments.remove')}
								title={$_('media.attachments.remove')}
							>
								<IconTrash size={18} />
							</button>
						</div>
					</li>
				{/each}
			</ul>
			<button class="add-urls" onclick={addAttachmentUrls} disabled={editorLocked}>
				{$_('media.attachments.add_urls')}
			</button>
		</section>
	{/if}

	<div class="actions">
		<div class="options">
			<MediaPicker multiple={true} disabled={editorLocked} on:pick={mediaPicked} />
			<EmojiPicker
				containsDefaultEmoji={false}
				autoClose={false}
				inEditor={true}
				onPick={onEmojiPick}
			/>
			<button class="clear editor-option advanced" {...collapsible.trigger}>
				{$_('editor.options.advanced')}
			</button>
		</div>
		<div>
			<button
				title="{$_('editor.post.button')} (Ctrl + Enter)"
				class="active"
				onclick={postNote}
				disabled={$author === undefined ||
					(content === '' && attachments.length === 0) ||
					$rom ||
					posting ||
					uploading}
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
	{#if $quotes.length > 0}
		{#each $quotes as quote}
			<Note item={new EventItem(quote)} readonly={true} />
		{/each}
	{/if}
	{#if uploading}
		<div class="uploading">
			<Loading />
		</div>
	{/if}
	{#if content !== '' || attachments.length > 0}
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

	.attachments {
		margin: 1rem;
		padding: 0.75rem;
	}

	.attachments ul {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin: 0 0 0.75rem;
	}

	.attachments li {
		display: grid;
		grid-template-columns: minmax(5rem, 8rem) minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.75rem;
	}

	.attachment-preview {
		max-height: 6rem;
		overflow: hidden;
	}

	.attachment-preview :global(img),
	.attachment-preview :global(video) {
		max-width: 100%;
		max-height: 6rem;
	}

	.attachment-preview :global(audio) {
		max-width: 100%;
	}

	.attachment-details,
	.attachment-actions {
		display: flex;
		gap: 0.5rem;
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
	}

	.attachment-state {
		color: var(--accent-gray);
		font-size: 0.8rem;
		font-weight: normal;
	}

	.attachment-state.failed {
		color: var(--red);
		font-weight: bold;
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

	.remove-attachment:hover:not(:disabled),
	.remove-attachment:focus-visible {
		opacity: 1;
		background: var(--accent-surface-high);
		color: var(--foreground);
	}

	.remove-attachment:focus-visible,
	.add-urls:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.add-urls {
		display: block;
		width: fit-content;
		margin: 0.25rem 0 0 auto;
		padding: 0.25rem 0.125rem;
		border-radius: 0;
		background: transparent;
		color: var(--accent-gray);
		font-weight: normal;
		text-decoration: none;
	}

	.add-urls:hover:not(:disabled),
	.add-urls:focus-visible {
		opacity: 1;
		color: var(--foreground);
		text-decoration: underline;
		text-underline-offset: 0.2em;
	}

	@media screen and (max-width: 480px) {
		.attachments {
			margin-inline: 0.5rem;
		}

		.attachments li {
			grid-template-columns: minmax(4.5rem, 6rem) minmax(0, 1fr) auto;
			gap: 0.5rem;
		}

		.attachment-actions {
			gap: 0.25rem;
		}

		.attachment-actions > button:not(.remove-attachment) {
			padding-inline: 0.65rem;
		}
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
