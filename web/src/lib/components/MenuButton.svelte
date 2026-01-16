<script lang="ts">
	import { createDropdownMenu, melt } from '@melt-ui/svelte';
	import { _ } from 'svelte-i18n';
	import { nip19 } from 'nostr-tools';
	import { ShortTextNote } from 'nostr-tools/kinds';
	import type { Event } from 'nostr-typedef';
	import { page } from '$app/stores';
	import { bookmark, unbookmark, isBookmarked } from '$lib/author/Bookmark';
	import { broadcast } from '$lib/Broadcast';
	import { copy } from '$lib/Clipboard';
	import { shareUrl } from '$lib/Share';
	import { rom, pubkey as authorPubkey, mutePubkeys, muteEventIds } from '$lib/stores/Author';
	import { developerMode } from '$lib/stores/Preference';
	import IconDots from '@tabler/icons-svelte/icons/dots';
	import IconBookmark from '@tabler/icons-svelte/icons/bookmark';
	import IconBookmarkFilled from '@tabler/icons-svelte/icons/bookmark-filled';
	import IconClipboard from '@tabler/icons-svelte/icons/clipboard';
	import IconLink from '@tabler/icons-svelte/icons/link';
	import IconCode from '@tabler/icons-svelte/icons/code';
	import IconCodeDots from '@tabler/icons-svelte/icons/code-dots';
	import IconBroadcast from '@tabler/icons-svelte/icons/broadcast';
	import IconTrash from '@tabler/icons-svelte/icons/trash';
	import IconVolumeOff from '@tabler/icons-svelte/icons/volume-off';
	import IconExternalLink from '@tabler/icons-svelte/icons/external-link';
	import { IconLanguage } from '@tabler/icons-svelte';
	import { deleteEvent } from '$lib/author/Delete';
	import { mute, unmute } from '$lib/author/Mute';
	import { referTags } from '$lib/EventHelper';
	import { getSeenOnRelays } from '$lib/timelines/MainTimeline';
	import { addToast } from './Toaster.svelte';
	import { get } from 'svelte/store';
	import { metadataStore } from '$lib/cache/Events';

	interface Props {
		event: Event;
		iconSize: number;
		showDetails?: boolean;
	}

	let { event, iconSize, showDetails = $bindable(false) }: Props = $props();

	const {
		elements: { menu, item, trigger, overlay, separator }
	} = createDropdownMenu({ preventScroll: false });

	let bookmarked = $derived(isBookmarked(event));
	let nevent = $derived(
		nip19.neventEncode({
			id: event.id,
			relays: getSeenOnRelays(event.id),
			author: event.pubkey,
			kind: event.kind
		})
	);
	let url = $derived(`${$page.url.origin}/${nevent}`);
	let rootId = $derived(referTags(event).root?.at(1) ?? event.id);

	async function onBookmark() {
		console.log('[bookmark]', event, $rom);

		if (bookmarked) {
			console.debug('[bookmark already]');
			return;
		}

		bookmarked = true;

		try {
			await bookmark(['e', event.id]);
		} catch (error) {
			console.error('[bookmark failed]', error);
			bookmarked = false;
			alert($_('actions.bookmark.failed'));
		}
	}

	async function onUnbookmark() {
		console.log('[unbookmark]', event, $rom);

		bookmarked = false;

		try {
			await unbookmark(['e', event.id]);
		} catch (error) {
			console.error('[remove bookmark failed]', error);
			bookmarked = true;
			alert($_('actions.unbookmark.failed'));
		}
	}

	async function onShare() {
		if (!(await shareUrl(url))) {
			await copy(url);
		}
	}

	function onEmbed(): void {
		const html = [
			// Workaround for Svelte compiler with script tags
			// eslint-disable-next-line no-useless-escape
			'<script type="module" src="https://cdn.jsdelivr.net/npm/nostr-widgets/dist/nostr-widgets.js"><\/script>',
			`<nostr-note data='${JSON.stringify(event).replaceAll("'", '&#39;')}'></nostr-note>`
		].join('');
		copy(html);
		addToast({
			data: {
				title: $_('actions.embed.copied.title'),
				description: $_('actions.embed.copied.description')
			}
		});
	}

	async function onDelete(): Promise<void> {
		if (!confirm($_('actions.delete.confirm'))) {
			return;
		}

		console.log('[delete]', event);
		await deleteEvent([event]);
	}

	function onTranslate(): void {
		const text = event.content
			.replaceAll(
				/\bnostr:((npub|nprofile)1[023456789acdefghjklmnpqrstuvwxyz]{6,})\b/g,
				(_, bech32: string, prefix: string) => {
					try {
						const result = nip19.decode(bech32);
						if (result.type !== 'npub' && result.type !== 'nprofile') {
							throw new Error('logic error');
						}
						const pubkey = result.type === 'npub' ? result.data : result.data.pubkey;
						const metadata = get(metadataStore).get(pubkey);
						if (metadata === undefined) {
							throw new Error('not found');
						}
						return `@${metadata.displayName}`;
					} catch {
						return `@${bech32.substring(0, prefix.length + '1'.length + 7)}`;
					}
				}
			)
			.replaceAll(
				/\bnostr:(?<bech32>(nevent|note)1[023456789acdefghjklmnpqrstuvwxyz]{6,})\b/g,
				'https://nostter.app/$<bech32>'
			);
		open(
			$_('thread.translation.url').replace('{0}', encodeURIComponent(text)),
			'_blank',
			'noopener,noreferrer'
		);
	}

	async function onMute(): Promise<void> {
		console.debug('[mute pubkey]', event.pubkey);

		try {
			await mute('p', event.pubkey);
		} catch (error) {
			console.error('[mute failed]', error);
			alert($_('actions.mute.failed'));
		}
	}

	async function onUnmute(): Promise<void> {
		console.debug('[unmute pubkey]', event.pubkey);

		try {
			await unmute('p', event.pubkey);
		} catch (error) {
			console.error('[unmute failed]', error);
			alert($_('actions.unmute.failed'));
		}
	}

	async function onMuteThread(): Promise<void> {
		console.debug('[mute thread]', rootId);

		try {
			await mute('e', rootId);
		} catch (error) {
			console.error('[mute failed]', error);
			alert($_('actions.mute.failed'));
		}
	}

	async function onUnmuteThread(): Promise<void> {
		console.debug('[unmute thread]', rootId);

		try {
			await unmute('e', rootId);
		} catch (error) {
			console.error('[unmute failed]', error);
			alert($_('actions.unmute.failed'));
		}
	}

	function onBroadcast(): void {
		if (event.tags.some((tag) => tag[0] === '-') && !confirm($_('actions.broadcast.confirm'))) {
			return;
		}
		broadcast(event);
	}
</script>

<button class="clear" use:melt={$trigger}>
	<IconDots size={iconSize} />
</button>
<div use:melt={$overlay} class="overlay"></div>
<div use:melt={$menu} class="menu">
	<div use:melt={$item} onclick={onTranslate} class="item">
		<div class="icon"><IconLanguage size={iconSize} /></div>
		<div>{$_('thread.translation.title')}</div>
		<div class="secondary-icon"><IconExternalLink /></div>
	</div>
	{#if !$rom && event.kind === ShortTextNote}
		{#if bookmarked}
			<div use:melt={$item} onclick={onUnbookmark} class="item undo">
				<div class="icon"><IconBookmarkFilled size={iconSize} /></div>
				<div>{$_('actions.unbookmark.button')}</div>
			</div>
		{:else}
			<div use:melt={$item} onclick={onBookmark} class="item">
				<div class="icon"><IconBookmark size={iconSize} /></div>
				<div>{$_('actions.bookmark.button')}</div>
			</div>
		{/if}
	{/if}
	<div use:melt={$item} onclick={() => copy(nevent)} class="item">
		<div class="icon"><IconClipboard size={iconSize} /></div>
		<div>{$_('actions.copy_id.button')}</div>
	</div>
	{#if navigator.canShare !== undefined}
		<div use:melt={$item} onclick={onShare} class="item">
			<div class="icon"><IconLink size={iconSize} /></div>
			<div>{$_('actions.share.button')}</div>
		</div>
	{:else}
		<div use:melt={$item} onclick={() => copy(url)} class="item">
			<div class="icon"><IconLink size={iconSize} /></div>
			<div>{$_('actions.copy_url.button')}</div>
		</div>
	{/if}
	<div use:melt={$item} onclick={onEmbed} class="item">
		<div class="icon"><IconCode size={iconSize} /></div>
		<div>{$_('actions.embed.button')}</div>
	</div>
	{#if !$rom}
		<div use:melt={$separator} class="separator"></div>
		<div class="text">{$_('preferences.mute.mute')}</div>
		{#if $mutePubkeys.includes(event.pubkey)}
			<div use:melt={$item} onclick={onUnmute} class="item undo">
				<div class="icon"><IconVolumeOff size={iconSize} /></div>
				<div>{$_('actions.unmute.user')}</div>
			</div>
		{:else if event.pubkey !== $authorPubkey}
			<div use:melt={$item} onclick={onMute} class="item">
				<div class="icon"><IconVolumeOff size={iconSize} /></div>
				<div>{$_('actions.mute.user')}</div>
			</div>
		{/if}
		{#if $muteEventIds.includes(rootId)}
			<div use:melt={$item} onclick={onUnmuteThread} class="item undo">
				<div class="icon"><IconVolumeOff size={iconSize} /></div>
				<div>{$_('actions.unmute.thread')}</div>
			</div>
		{:else}
			<div use:melt={$item} onclick={onMuteThread} class="item">
				<div class="icon"><IconVolumeOff size={iconSize} /></div>
				<div>{$_('actions.mute.thread')}</div>
			</div>
		{/if}
		{#if event.pubkey === $authorPubkey}
			<div use:melt={$separator} class="separator"></div>
			<div class="text">{$_('menu.caution')}</div>
			<div use:melt={$item} onclick={onDelete} class="item">
				<div class="icon"><IconTrash size={iconSize} /></div>
				<div>{$_('actions.delete.button')}</div>
			</div>
		{/if}
	{/if}
	{#if $developerMode}
		<div use:melt={$separator} class="separator"></div>
		<div class="text">{$_('menu.developer')}</div>
		<div use:melt={$item} onclick={() => (showDetails = !showDetails)} class="item">
			<div class="icon"><IconCodeDots size={iconSize} /></div>
			<div>{$_('actions.details.button')}</div>
		</div>
		<div use:melt={$item} onclick={onBroadcast} class="item">
			<div class="icon"><IconBroadcast size={iconSize} /></div>
			<div>{$_('actions.broadcast.button')}</div>
		</div>
	{/if}
</div>

<style>
	button {
		color: var(--accent-gray);
	}
</style>
