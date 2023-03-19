<script lang="ts">
	import { IconExternalLink, IconRepeat } from '@tabler/icons-svelte';
	import { events } from '../stores/Events';
	import { pool } from '../stores/Pool';
	import { userEvents } from '../stores/UserEvents';
	import NoteView from './NoteView.svelte';
	import type { Event as NostrEvent } from './types';
	import { relayUrls } from '../stores/Author';
	import { nip19, type Event } from 'nostr-tools';

	export let event: NostrEvent;
	export let readonly: boolean;

	let user = $userEvents.get(event.pubkey)?.user;
	let originalEvent: NostrEvent | undefined;

	const originalTag = event.tags.find(
		(tag) =>
			tag.at(0) === 'e' && (tag.at(3) === 'mention' || tag.at(3) === 'root' || tag.length < 4)
	);
	if (originalTag !== undefined) {
		const eventId = originalTag[1];
		originalEvent = $events.find((x) => x.id === eventId);
		if (originalEvent === undefined) {
			$pool
				.get($relayUrls, {
					kinds: [1],
					'#e': [eventId]
				})
				.then((event: Event | null) => {
					if (event !== null) {
						originalEvent = event as NostrEvent;
						let userEvent = $userEvents.get(originalEvent.pubkey);
						if (userEvent !== undefined) {
							originalEvent.user = userEvent.user;
						}
					} else {
						console.warn(`${eventId} not found`);
					}
				});
		}
	} else {
		console.error(event);
	}
</script>

<article>
	<IconRepeat size={18} color={'lightgreen'} /> by @{user !== undefined
		? user.name
		: event.pubkey.substring('npub1'.length + 7)}
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
