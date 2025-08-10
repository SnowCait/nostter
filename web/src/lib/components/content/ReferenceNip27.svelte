<script lang="ts">
	import { nip19 } from 'nostr-tools';
	import { onMount } from 'svelte';
	import { deletedEventIdsByPubkey } from '$lib/author/Delete';
	import { events } from '$lib/stores/Events';
	import { isMuteEvent } from '$lib/stores/Author';
	import Text from './Text.svelte';
	import Nip94 from '../Nip94.svelte';
	import Naddr from './Naddr.svelte';
	import EventComponent from '../items/EventComponent.svelte';
	import { EventItem, Metadata, alternativeName } from '$lib/Items';
	import { eventItemStore, metadataStore } from '$lib/cache/Events';
	import NoteLink from '../items/NoteLink.svelte';
	import DeletedContent from '../items/DeletedContent.svelte';
	import MutedContent from '../items/MutedContent.svelte';
	import { pollKind } from '$lib/Poll';
	import { fetchLastEvent } from '$lib/RxNostrHelper';
	import { getSeenOnRelays } from '$lib/timelines/MainTimeline';
	import { goto } from '$app/navigation';

	export let text: string;

	let dataType: 'user' | 'event' | 'addr';
	let pubkey: string | undefined;
	let metadata: Metadata | undefined;
	let eventId: string | undefined;
	let item: EventItem | undefined;
	let addressPointer: nip19.AddressPointer;

	$: slug = text.substring('nostr:'.length);

	$: {
		try {
			const { type, data } = nip19.decode(slug);
			switch (type) {
				case 'npub': {
					dataType = 'user';
					pubkey = data as string;
					break;
				}
				case 'note': {
					dataType = 'event';
					eventId = data as string;
					item = $events.find((x) => x.event.id === eventId);
					break;
				}
				case 'nprofile': {
					dataType = 'user';
					const profile = data as nip19.ProfilePointer;
					pubkey = profile.pubkey;
					break;
				}
				case 'nevent': {
					dataType = 'event';
					const e = data as nip19.EventPointer;
					eventId = e.id;
					item = $events.find((x) => x.event.id === eventId);
					break;
				}
				case 'naddr': {
					dataType = 'addr';
					addressPointer = data;
					break;
				}
			}
		} catch (e) {
			console.warn('[decode failed]', text, e);
		}
	}

	$: if (dataType === 'user' && pubkey !== undefined) {
		metadata = $metadataStore.get(pubkey);
	}

	$: if (dataType === 'event' && item === undefined && eventId !== undefined) {
		item = $eventItemStore.get(eventId);
	}

	onMount(async () => {
		if (dataType === 'addr') {
			const e = await fetchLastEvent({
				kinds: [addressPointer.kind],
				authors: [addressPointer.pubkey],
				'#d': [addressPointer.identifier]
			});
			if (e !== undefined) {
				item = new EventItem(e);
			}
		}
	});

	async function navigate(event: MouseEvent | KeyboardEvent): Promise<void> {
		if (item === undefined || !(event.target instanceof HTMLElement)) {
			return;
		}
		const element = event.target;
		if (
			['a', 'button', 'img', 'video', 'audio', 'dialog'].some((selectors) =>
				element.closest(selectors)
			)
		) {
			return;
		}
		const nevent = nip19.neventEncode({
			id: item.event.id,
			relays: getSeenOnRelays(item.event.id),
			author: item.event.pubkey,
			kind: item.event.kind
		});
		await goto(`/${nevent}`);
	}
</script>

{#if dataType === 'user' && pubkey !== undefined}
	<a
		href="/{nip19.nprofileEncode({
			pubkey,
			relays: metadata ? getSeenOnRelays(metadata.event.id) : undefined
		})}"
	>
		@{metadata !== undefined ? metadata.displayName : alternativeName(pubkey)}
	</a>
{:else if dataType === 'event' && eventId !== undefined}
	{#if item !== undefined}
		{#if $deletedEventIdsByPubkey.get(item.event.pubkey)?.has(item.event.id)}
			<blockquote>
				<DeletedContent />
			</blockquote>
		{:else if isMuteEvent(item.event)}
			<blockquote>
				<MutedContent />
			</blockquote>
		{:else if Number(item.event.kind) === 1063}
			<Nip94 event={item.event} />
		{:else if Number(item.event.kind) === pollKind}
			<blockquote><EventComponent {item} readonly={true} /></blockquote>
		{:else}
			<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
			<blockquote on:click={navigate} on:keydown={navigate}>
				<EventComponent {item} readonly={true} />
			</blockquote>
		{/if}
	{:else}
		<blockquote><NoteLink {eventId} /></blockquote>
	{/if}
{:else if dataType === 'addr'}
	{#if item !== undefined && Number(item.event.kind) === 30030}
		{#if $deletedEventIdsByPubkey.get(item.event.pubkey)?.has(item.event.id)}
			<blockquote>
				<DeletedContent />
			</blockquote>
		{:else if isMuteEvent(item.event)}
			<blockquote>
				<MutedContent />
			</blockquote>
		{:else}
			<blockquote>
				<EventComponent {item} readonly={true} />
			</blockquote>
		{/if}
	{:else}
		<Naddr naddr={slug} />
	{/if}
{:else}
	<Text {text} />
{/if}

<style>
	a:has(blockquote) {
		text-decoration: none;
	}
</style>
