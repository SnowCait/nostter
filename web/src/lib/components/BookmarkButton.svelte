<script lang="ts">
	import { _ } from 'svelte-i18n';
	import type { Event } from 'nostr-typedef';
	import { Kind } from 'nostr-tools';
	import { isBookmarked } from '$lib/author/Bookmark';
	import { pubkey, rom, writeRelays } from '../../stores/Author';
	import { pool } from '../../stores/Pool';
	import IconBookmark from '@tabler/icons-svelte/dist/svelte/icons/IconBookmark.svelte';
	import IconBookmarkFilled from '@tabler/icons-svelte/dist/svelte/icons/IconBookmarkFilled.svelte';
	import { Api } from '$lib/Api';

	export let event: Event;
	export let iconSize: number;

	$: bookmarked = isBookmarked(event);

	async function bookmark(note: Event) {
		console.log('[bookmark]', note, $rom);

		if ($rom) {
			console.error('Readonly');
			return;
		}

		if (bookmarked) {
			console.debug('[bookmark already]');
			return;
		}

		bookmarked = true;

		const api = new Api($pool, $writeRelays);
		const latestEvent = await api.fetchBookmarkEvent($pubkey);
		console.log('[bookmark latest]', latestEvent);
		if (
			latestEvent !== undefined &&
			latestEvent.tags.some(([tagName, id]) => tagName === 'e' && id === note.id)
		) {
			console.log('[bookmark already]', note);
			return;
		}

		api.signAndPublish(30001 as Kind, latestEvent?.content ?? '', [
			...(latestEvent?.tags ?? [['d', 'bookmark']]),
			['e', note.id]
		]).catch((error) => {
			console.error('[bookmark failed]', error);
			bookmarked = false;
			alert($_('actions.bookmark.failed'));
		});
	}

	async function unbookmark(note: Event) {
		console.log('[unbookmark]', note, $rom);

		if ($rom) {
			console.error('Readonly');
			return;
		}

		if (!bookmarked) {
			console.debug('[not bookmarked]');
			return;
		}

		if (!confirm($_('actions.unbookmark.confirm'))) {
			return;
		}

		bookmarked = false;

		const api = new Api($pool, $writeRelays);
		const latestEvent = await api.fetchBookmarkEvent($pubkey);
		console.log('[bookmark latest]', latestEvent);
		if (
			latestEvent === undefined ||
			!latestEvent.tags.some(([tagName, id]) => tagName === 'e' && id === note.id)
		) {
			console.log('[bookmark removed already]', note);
			return;
		}

		api.signAndPublish(
			30001 as Kind,
			latestEvent.content,
			latestEvent.tags.filter(([tagName, id]) => !(tagName === 'e' && id === note.id))
		).catch((error) => {
			console.error('[remove bookmark failed]', error);
			bookmarked = true;
			alert($_('actions.unbookmark.failed'));
		});
	}
</script>

<button
	class="bookmark clear"
	class:hidden={!(event.kind === Kind.Text || event.kind === Kind.ChannelMessage)}
	class:bookmarked
	on:click={() => (bookmarked ? unbookmark(event) : bookmark(event))}
>
	{#if bookmarked}
		<IconBookmarkFilled size={iconSize} />
	{:else}
		<IconBookmark size={iconSize} />
	{/if}
</button>

<style>
	.bookmark {
		color: var(--accent-gray);
	}

	.bookmark.bookmarked {
		color: var(--red);
	}
</style>
