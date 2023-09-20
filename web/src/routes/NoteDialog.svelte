<script lang="ts">
	import { pool } from '../stores/Pool';
	import { pubkey, rom, writeRelays, readRelays } from '../stores/Author';
	import { openNoteDialog, replyTo, quotes, intentContent } from '../stores/NoteDialog';
	import Note from './timeline/Note.svelte';
	import IconSend from '@tabler/icons-svelte/dist/svelte/icons/IconSend.svelte';
	import { Api } from '$lib/Api';
	import { Content } from '$lib/Content';
	import { Kind, nip19, type Event as NostrEvent } from 'nostr-tools';
	import type { ProfilePointer } from 'nostr-tools/lib/nip19';
	import { userEvents } from '../stores/UserEvents';
	import type { UserEvent, User } from './types';
	import { customEmojiTags } from '../stores/CustomEmojis';
	import { onMount, tick } from 'svelte';
	import { Channel, channelIdStore } from '$lib/Channel';
	import { cachedEvents, channelMetadataEvents } from '$lib/cache/Events';
	import ChannelTitle from './parts/ChannelTitle.svelte';
	import EmojiPickerSlide from './parts/EmojiPickerSlide.svelte';
	import CustomEmojiList from './timeline/CustomEmojiList.svelte';
	import CustomEmoji from './content/CustomEmoji.svelte';

	let content = '';
	let posting = false;
	let dialog: HTMLDialogElement;
	let textarea: HTMLTextAreaElement;
	let pubkeys = new Set<string>();
	let complementStart = -1;
	let complementEnd = -1;
	let complementUserEvents: UserEvent[] = [];
	let selectedCustomEmojis = new Map<string, string>();
	let autocompleting = false;
	let channelEvent: NostrEvent | undefined;
	let emojiTags: string[][] = [];

	channelIdStore.subscribe((channelId) => {
		if (channelId !== undefined) {
			channelEvent = channelMetadataEvents.get(channelId) ?? cachedEvents.get(channelId);
		} else {
			channelEvent = undefined;
		}
	});

	onMount(async () => {
		const { default: Tribute } = await import('tributejs');

		const tribute = new Tribute({
			trigger: ':',
			positionMenu: false,
			values: $customEmojiTags.map(([, shortcode, imageUrl]) => {
				return {
					shortcode,
					imageUrl
				};
			}),
			lookup: 'shortcode',
			fillAttr: 'shortcode',
			menuContainer: dialog,
			menuItemTemplate: (item) =>
				`<img src="${item.original.imageUrl}" alt=":${item.original.shortcode}:"><span>:${item.original.shortcode}:</span>`,
			selectTemplate: (item) => `:${item.original.shortcode}:`,
			noMatchTemplate: () =>
				'<a href="https://emojis-iota.vercel.app/" target="_blank" rel="noopener noreferrer">Add custom emojis</a>'
		});
		tribute.attach(textarea);
		console.debug('[tribute]', tribute);

		customEmojiTags.subscribe((tags) => {
			console.debug('[custom emojis updated]', tags);
			tribute.append(
				0,
				tags.map(([, shortcode, imageUrl]) => {
					return {
						shortcode,
						imageUrl
					};
				})
			);
		});

		textarea.addEventListener('tribute-replaced', (e: any) => {
			console.debug('[tribute replaced]', e);
			selectedCustomEmojis.set(
				e.detail.item.original.shortcode,
				e.detail.item.original.imageUrl
			);
			console.timeLog('tribute');
		});

		textarea.addEventListener('tribute-active-true', (e) => {
			console.debug('[tribute active true]', e);
			autocompleting = true;
			console.time('tribute');
		});

		textarea.addEventListener('tribute-active-false', (e) => {
			console.debug('[tribute active false]', e);
			setTimeout(() => {
				console.log('[tribute closeable]');
				autocompleting = false;
				console.timeEnd('tribute');
			}, 200);
		});
	});

	openNoteDialog.subscribe((open) => {
		console.log('[open]', open);
		if (open) {
			if ($quotes.length > 0) {
				content =
					'\n' + $quotes.map((event) => `nostr:${nip19.noteEncode(event.id)}`).join('\n');
			}
			// Wait for content updated
			setTimeout(() => {
				console.log(textarea, textarea.selectionStart);
				textarea.setSelectionRange(0, 0);
				dialog.showModal();
				textarea.focus();
			}, 10);
		}
	});

	intentContent.subscribe((value) => {
		console.log('[content override]');

		content = value;
		value = '';
	});

	function closeDialog(event: MouseEvent) {
		console.debug('[click]', `(${event.x}, ${event.y})`);

		if (autocompleting) {
			return;
		}

		const insideDialog =
			event.x >= dialog.offsetLeft &&
			event.x <= dialog.offsetLeft + dialog.offsetWidth &&
			event.y >= dialog.offsetTop &&
			event.y <= dialog.offsetTop + dialog.offsetHeight;

		if (!insideDialog) {
			dialog.close();
		}
	}

	async function closed(event: Event) {
		console.log(`[${event.type}]`);
		$openNoteDialog = false;
		content = '';
		pubkeys.clear();
		$replyTo = undefined;
		$quotes = [];
		exitComplement();
		emojiTags = [];
	}

	async function submitFromKeyboard(event: KeyboardEvent) {
		console.debug(`[${event.type}]`, event.code, event.key, event.ctrlKey, event.metaKey);
		if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
			await postNote();
		}
	}

	async function onInput(inputEvent: Event) {
		const { selectionStart, selectionEnd } = textarea;
		console.debug(
			'[complement input]',
			inputEvent,
			content,
			complementStart,
			selectionStart,
			selectionEnd
		);
		if (!(inputEvent instanceof InputEvent)) {
			console.warn('[complement input type]', typeof inputEvent);
			return;
		}

		if (
			selectionStart === selectionEnd &&
			selectionStart > 0 &&
			content.lastIndexOf('@', selectionStart) >= 0
		) {
			complementStart = content.lastIndexOf('@', selectionStart);
		} else if (content.lastIndexOf('@', selectionStart) < 0) {
			exitComplement();
		}

		if (complementStart >= 0) {
			complementEnd = selectionEnd;
			const complementName = content.slice(complementStart + 1, selectionStart).toLowerCase();
			const max = 5;
			complementUserEvents = [...$userEvents]
				.filter(
					([, e]) =>
						e.user?.name?.toLowerCase().startsWith(complementName) ||
						e.user?.display_name?.toLowerCase().startsWith(complementName)
				)
				.map(([, e]) => e)
				.slice(0, max);
			if (complementUserEvents.length < max) {
				complementUserEvents.push(
					...[...$userEvents]
						.filter(
							([, e]) =>
								e.user?.name?.toLowerCase().includes(complementName) ||
								e.user?.display_name?.toLowerCase().includes(complementName)
						)
						.filter(([p]) => !complementUserEvents.some((x) => x.pubkey === p))
						.map(([, e]) => e)
						.slice(0, max - complementUserEvents.length)
				);
			}
			if (complementUserEvents.length < max) {
				// TODO: fetch
			}
			console.debug(
				'[complement]',
				complementName,
				complementUserEvents.map((x) => `@${x.user.name}, ${x.pubkey}`)
			);

			// Exit if not found
			if (complementUserEvents.length === 0) {
				exitComplement();
			}
		}
	}

	async function replaceComplement(event: UserEvent) {
		console.debug('[replace complement]', content, complementStart, complementEnd);
		const beforeCursor =
			content.substring(0, complementStart) + `nostr:${nip19.npubEncode(event.pubkey)} `;
		const afterCursor = content.substring(complementEnd);
		content = beforeCursor + afterCursor;
		const cursor = beforeCursor.length;
		console.debug('[replaced complement]', content, cursor);
		exitComplement();
		await tick();
		textarea.setSelectionRange(cursor, cursor);
		textarea.focus();
	}

	function exitComplement() {
		complementStart = -1;
		complementEnd = -1;
		complementUserEvents = [];
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
		if (content === '') {
			console.log('Content is empty');
			return;
		}

		if ($rom) {
			console.error('Readonly');
			return;
		}

		if (posting) {
			console.error('Posting');
			return;
		}

		posting = true;

		let tags: string[][] = [];
		if ($channelIdStore) {
			tags.push(['e', $channelIdStore, '', 'root']);
			if ($replyTo !== undefined) {
				tags.push(['e', $replyTo.id, '', 'reply']);
				if (
					$replyTo.tags.some(
						([tagName, pubkey]) => tagName === 'p' && pubkey === $replyTo?.pubkey
					)
				) {
					tags.push(...$replyTo.tags.filter(([tagName]) => tagName === 'p'));
				} else {
					tags.push(...$replyTo.tags.filter(([tagName]) => tagName === 'p'), [
						'p',
						$replyTo.pubkey
					]);
				}
			}
		} else if ($replyTo !== undefined) {
			if ($replyTo.tags.filter((x) => x[0] === 'e').length === 0) {
				// root
				tags.push(['e', $replyTo.id, '', 'root']);
			} else {
				// reply
				tags.push(['e', $replyTo.id, '', 'reply']);
				const root = $replyTo.tags.find(
					([tagName, , , marker]) => tagName === 'e' && marker === 'root'
				);
				if (root !== undefined) {
					tags.push(['e', root[1], '', 'root']);
				}
			}
			pubkeys = new Set([
				$replyTo.pubkey,
				...$replyTo.tags.filter((x) => x[0] === 'p').map((x) => x[1])
			]);
		}

		const eventIds = Content.findNotesAndNeventsToIds(content);
		tags.push(...Array.from(new Set(eventIds)).map((eventId) => ['e', eventId, '', 'mention']));

		for (const { type, data } of Content.findNpubsAndNprofiles(content).map((x) => {
			try {
				return nip19.decode(x);
			} catch {
				return { type: undefined, data: undefined };
			}
		})) {
			switch (type) {
				case 'npub': {
					pubkeys.add(data as string);
					break;
				}
				case 'nprofile': {
					pubkeys.add((data as ProfilePointer).pubkey);
				}
			}
		}
		tags.push(...Array.from(pubkeys).map((pubkey) => ['p', pubkey]));

		const hashtags = Content.findHashtags(content);
		tags.push(...Array.from(hashtags).map((hashtag) => ['t', hashtag]));

		// Custom emojis
		tags.push(...emojiTags);
		const readApi = new Api($pool, $readRelays);
		const shortcodes = Array.from(
			new Set(
				[...content.matchAll(/:(?<shortcode>\w+):/g)]
					.map((match) => match.groups?.shortcode)
					.filter((x): x is string => x !== undefined)
			)
		);
		new Map(
			['npub']
				.filter((x) => x.startsWith('npub'))
				.map((x) => {
					try {
						// throw new Error();
						return [x, (x + 1) as string];
					} catch (e) {
						return [x, ''];
					}
				})
		);
		const customEmojiPubkeysMap = new Map(
			shortcodes
				.filter((shortcode) => shortcode.startsWith('npub1'))
				.map((npub) => {
					try {
						const { data: pubkey } = nip19.decode(npub);
						return [npub, pubkey as string];
					} catch (error) {
						console.warn('[invalid npub]', npub, error);
						return [npub, undefined];
					}
				})
		);
		const customEmojiMetadataEventsMap = await readApi.fetchMetadataEventsMap(
			[...customEmojiPubkeysMap]
				.map(([, pubkey]) => pubkey)
				.filter((pubkey): pubkey is string => pubkey !== undefined)
		);
		tags.push(
			...shortcodes
				.filter(([, shortcode]) => !emojiTags.some(([, s]) => s === shortcode))
				.map((shortcode) => {
					const imageUrl = selectedCustomEmojis.get(shortcode);
					if (imageUrl === undefined) {
						const pubkey = customEmojiPubkeysMap.get(shortcode);
						if (pubkey === undefined) {
							return null;
						}
						const metadataEvent = customEmojiMetadataEventsMap.get(pubkey);
						if (metadataEvent === undefined) {
							return null;
						}
						try {
							const metadata = JSON.parse(metadataEvent.content) as User;
							const picture = new URL(metadata.picture);
							return ['emoji', shortcode, picture.href];
						} catch (error) {
							console.warn('[invalid metadata]', metadataEvent, error);
							return null;
						}
					}
					return ['emoji', shortcode, imageUrl];
				})
				.filter((x): x is string[] => x !== null)
		);

		const api = new Api($pool, $writeRelays);
		try {
			await api.signAndPublish(
				$channelIdStore !== undefined || $replyTo?.kind === Kind.ChannelMessage
					? Kind.ChannelMessage
					: Kind.Text,
				Content.replaceNip19(content),
				tags
			);
			console.log('[success]');
			dialog.close();
		} catch (error) {
			console.error('[failure]', error);
		} finally {
			posting = false;
		}
	}
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<dialog bind:this={dialog} on:click={closeDialog} on:close={closed}>
	{#if channelEvent !== undefined}
		<ChannelTitle channelMetadata={Channel.parseMetadata(channelEvent)} />
	{/if}
	{#if $replyTo}
		<Note event={$replyTo} readonly={true} />
	{/if}
	<form on:submit|preventDefault={postNote}>
		<textarea
			placeholder="What's happening?"
			bind:value={content}
			bind:this={textarea}
			on:keydown={submitFromKeyboard}
			on:keyup|stopPropagation={() => console.debug}
			on:input={onInput}
		/>
		<input id="send" type="submit" disabled={!pubkey || posting} />
		<label for="send"><IconSend size={30} /></label>
	</form>
	<div class="emoji-picker">
		<EmojiPickerSlide on:pick={onEmojiPick} />
	</div>
	{#if $quotes.length > 0}
		{#each $quotes as quote}
			<Note event={quote} readonly={true} />
		{/each}
	{/if}
	{#if complementStart >= 0}
		<ul>
			{#each complementUserEvents as event}
				<li on:click|stopPropagation={async () => await replaceComplement(event)}>
					<span>{event.user.display_name ?? ''}</span>
					<span>@{event.user.name ?? event.user.display_name}</span>
				</li>
			{/each}
		</ul>
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
</dialog>

<style>
	dialog {
		border: 1px;
		border-style: solid;
		border-color: lightgray;
		border-radius: 10px;
		max-width: 100%;
		margin: 0 auto;
		z-index: 1;
		width: 50%;
	}

	@media screen and (max-width: 600px) {
		dialog {
			width: 90%;
		}
	}

	textarea {
		width: 100%;
		height: 4em;
	}

	label {
		display: block;
		margin-left: auto;
		width: 30px;
	}

	input[type='submit'] {
		display: none;
	}

	input[type='submit']:disabled + label {
		color: lightgray;
	}

	label {
		height: 30px;
	}

	ul {
		list-style: none;
		padding: 0;
	}

	.emoji-picker {
		margin-top: -30px;
	}

	:global(.tribute-container ul) {
		list-style: none;
		padding: 0;

		background-color: white;
		max-height: 10rem;
		overflow: auto;
	}

	:global(.tribute-container li.highlight) {
		background-color: lightgray;
	}

	:global(.tribute-container img) {
		height: 1.5rem;
		margin: 0 0.5rem;
	}
</style>
