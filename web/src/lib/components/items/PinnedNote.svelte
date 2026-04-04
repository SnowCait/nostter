<script lang="ts">
	import { authorActionReqEmit } from '$lib/author/Action';
	import { hexRegexp } from '$lib/Constants';
	import { fetchPinnedNoteEvent, pinnedNotesEvents } from '$lib/PinnedNotes';
	import { referencesReqEmit, rxNostr, tie } from '$lib/timelines/MainTimeline';
	import { IconPinnedFilled } from '@tabler/icons-svelte';
	import type { Event } from 'nostr-typedef';
	import { createRxBackwardReq, uniq } from 'rx-nostr';
	import { tap } from 'rxjs';
	import { _ } from 'svelte-i18n';
	import EventComponent from './EventComponent.svelte';
	import { EventItem } from '$lib/Items';
	import NoteLink from './NoteLink.svelte';
	import { navigateTo } from '$lib/Navigation';

	interface Props {
		pubkey: string;
		slug: string;
	}

	let { pubkey, slug }: Props = $props();

	const isEventTag = (tag: string[]): boolean =>
		tag[0] === 'e' && typeof tag[1] === 'string' && hexRegexp.test(tag[1]);
	let pinnedNotes = $derived(pinnedNotesEvents.get(pubkey)?.tags.filter(isEventTag) ?? []);
	let eventId = $derived(pinnedNotes.at(-1)?.[1]);
	let event = $state<Event>();

	$effect(() => {
		if (eventId === undefined) {
			return;
		}

		const req = createRxBackwardReq();
		rxNostr
			.use(req)
			.pipe(
				tie,
				uniq(),
				tap(({ event }) => {
					referencesReqEmit(event);
					authorActionReqEmit(event);
				})
			)
			.subscribe(({ event: e }) => {
				event = e;
			});
		req.emit([{ ids: [eventId] }]);
		req.over();
	});

	$effect(() => {
		fetchPinnedNoteEvent(pubkey);
	});
</script>

{#if eventId}
	<section class="card">
		<header>
			<IconPinnedFilled size={18} />
			<span>{$_('pinned-notes.profile')}</span>
			<span class:hidden={pinnedNotes.length <= 1}>
				<a href="/{slug}/pins">{$_('pinned-notes.more')} ({pinnedNotes.length})</a>
			</span>
		</header>

		{#if event !== undefined}
			<div
				role="link"
				tabindex="0"
				class="navigation"
				onclick={(e) => navigateTo(e, $state.snapshot(event!))}
				onkeydown={(e) => navigateTo(e, $state.snapshot(event!))}
			>
				<EventComponent item={new EventItem(event)} readonly={false} />
			</div>
		{:else}
			<div>
				<NoteLink {eventId} />
			</div>
		{/if}
	</section>
{/if}

<style>
	section {
		padding: 0;
	}

	header {
		display: flex;
		align-items: center;
		font-size: 0.9rem;
		margin: 0.5rem;
	}

	header *:last-child {
		margin-left: auto;
	}

	.hidden {
		visibility: hidden;
	}

	a {
		text-decoration: none;
	}
</style>
