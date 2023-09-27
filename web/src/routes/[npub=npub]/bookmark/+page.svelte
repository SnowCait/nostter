<script lang="ts">
	import { Api } from '$lib/Api';
	import { onMount } from 'svelte';
	import type { Event as NostrEvent } from 'nostr-tools';
	import { pool } from '../../../stores/Pool';
	import { pubkey as authorPubkey, readRelays, rom, bookmarkEvent } from '../../../stores/Author';
	import { page } from '$app/stores';
	import { User } from '$lib/User';
	import { error } from '@sveltejs/kit';
	import TimelineView from '../../TimelineView.svelte';
	import { Signer } from '$lib/Signer';
	import { EventItem } from '$lib/Items';

	let publicBookmarkEventItems: EventItem[] = [];
	let privateBookmarkEventItems: EventItem[] = [];

	onMount(async () => {
		const slug = $page.params.npub;
		console.log('[bookmark page]', slug);

		const { pubkey, relays } = await User.decode(slug);

		if (pubkey === undefined) {
			throw error(404);
		}

		const api = new Api($pool, Array.from(new Set([...relays, ...$readRelays])));
		const event = $bookmarkEvent;
		console.log('[bookmark]', event);

		if (event === undefined) {
			return;
		}

		const originalPublicBookmarkEvents = await api.fetchEventsByIds(
			event.tags
				.filter(([tagName, id]) => tagName === 'e' && id !== undefined)
				.map(([, id]) => id)
		);

		let originalPrivateBookmarkEvents: NostrEvent[] = [];
		if (pubkey === $authorPubkey && !$rom && event.content !== '') {
			try {
				const json = await Signer.decrypt($authorPubkey, event.content);
				const privateBookmark: string[][] = JSON.parse(json);
				originalPrivateBookmarkEvents = await api.fetchEventsByIds(
					privateBookmark
						.filter(([tagName, id]) => tagName === 'e' && id !== undefined)
						.map(([, id]) => id)
				);
			} catch (error) {
				console.warn('[nip04.decrypt]', error, event);
			}
		}
		console.log('[bookmarks]', originalPublicBookmarkEvents, originalPrivateBookmarkEvents);

		const metadataEvents = await api.fetchMetadataEventsMap(
			Array.from(
				new Set([
					...originalPublicBookmarkEvents.map((x) => x.pubkey),
					...originalPrivateBookmarkEvents.map((x) => x.pubkey)
				])
			)
		);
		console.log('[bookmark metadata]', metadataEvents);

		publicBookmarkEventItems = originalPublicBookmarkEvents.map(
			(event) => new EventItem(event, metadataEvents.get(event.pubkey))
		);
		privateBookmarkEventItems = originalPrivateBookmarkEvents.map(
			(event) => new EventItem(event, metadataEvents.get(event.pubkey))
		);
	});
</script>

<h1>Bookmark</h1>

{#if privateBookmarkEventItems.length > 0}
	<h2>Private</h2>

	<TimelineView
		items={privateBookmarkEventItems}
		load={async () => console.debug()}
		showLoading={false}
	/>
{/if}

<h2>Public</h2>

<TimelineView
	items={publicBookmarkEventItems}
	load={async () => console.debug()}
	showLoading={false}
/>
