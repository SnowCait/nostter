<script lang="ts">
	import { IconExternalLink, IconRepeat } from '@tabler/icons-svelte';
	import { pool } from '../stores/Pool';
	import NoteView from './NoteView.svelte';
	import type { Event as NostrEvent, User } from './types';
	import { relayUrls } from '../stores/Author';
	import { nip19 } from 'nostr-tools';
	import { onMount } from 'svelte';
	import { Api } from '$lib/Api';

	export let event: NostrEvent;
	export let readonly: boolean;

	let user: User | undefined;
	let originalEvent: NostrEvent | undefined;

	const originalTag = event.tags.find(
		(tag) =>
			tag.at(0) === 'e' && (tag.at(3) === 'mention' || tag.at(3) === 'root' || tag.length < 4)
	);

	onMount(async () => {
		const api = new Api($pool, $relayUrls);
		api.fetchUserEvent(event.pubkey).then((userEvent) => {
			user = userEvent?.user;
		});

		if (originalTag === undefined) {
			console.warn('[repost not found]', event);
			return;
		}

		const eventId = originalTag[1];
		originalEvent = await api.fetchEvent(eventId);
	});
</script>

<article>
	<IconRepeat size={18} color={'lightgreen'} />
	<span>by</span>
	<a href="/{nip19.npubEncode(event.pubkey)}">
		@{user?.name ?? event.pubkey.substring('npub1'.length + 7)}
	</a>
</article>
{#if originalEvent !== undefined}
	<NoteView event={originalEvent} {readonly} />
{:else if originalTag !== undefined}
	<article>
		<a
			href="https://nostx.shino3.net/{nip19.noteEncode(originalTag[1])}"
			target="_blank"
			rel="noopener noreferrer"
		>
			{nip19.noteEncode(originalTag[1]).substring(0, 'note1'.length + 7)}<IconExternalLink
				size={15}
			/>
		</a>
	</article>
{/if}

<style>
	article {
		margin: 12px 16px;
	}
</style>
