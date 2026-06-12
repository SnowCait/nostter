<script lang="ts">
	import { _ } from 'svelte-i18n';
	import type * as Nostr from 'nostr-typedef';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { appName } from '$lib/Constants';
	import { fetchListEvent, getListPubkeys, getListTitle } from '$lib/List';
	import type { Metadata } from '$lib/Items';
	import { metadataReqEmit } from '$lib/timelines/MainTimeline';
	import { metadataStore } from '$lib/cache/Events';
	import { lastNoteReqEmit } from '$lib/LastNotes';
	import { author } from '$lib/stores/Author';
	import FollowAllButton from '$lib/components/actions/FollowAllButton.svelte';
	import Loading from '$lib/components/Loading.svelte';
	import type { PageProps } from './$types';
	import TimelineView from '../../../../../TimelineView.svelte';
	import ProfileTabs from '../../../ProfileTabs.svelte';

	let { data }: PageProps = $props();

	let slug = $derived(page.params.slug!);

	let listEvent = $state<Nostr.Event | undefined>();
	let pubkeys = $state<string[]>([]);
	let loading = $state(true);

	let title = $derived(listEvent === undefined ? '' : getListTitle(listEvent.tags));

	let items = $derived(
		pubkeys
			.map((pubkey) => $metadataStore.get(pubkey))
			.filter((metadata): metadata is Metadata => metadata !== undefined)
	);

	afterNavigate(async () => {
		console.debug('[list members page]', data.naddr, data);

		listEvent = undefined;
		pubkeys = [];
		loading = true;

		listEvent = await fetchListEvent(data.kind, data.pubkey, data.identifier);
		loading = false;

		if (listEvent === undefined) {
			return;
		}

		pubkeys = await getListPubkeys(listEvent);
		metadataReqEmit(pubkeys);

		if ($author !== undefined) {
			lastNoteReqEmit(pubkeys);
		}
	});
</script>

<svelte:head>
	<title>{appName} - {title} {$_('lists.members')}</title>
</svelte:head>

<ProfileTabs tab="lists" {slug} />

{#if listEvent !== undefined}
	<div>
		<h1>{title} ({pubkeys.length})</h1>
		<FollowAllButton {pubkeys} />
	</div>
	<TimelineView {items} showLoading={false} />
{:else if loading}
	<Loading />
{:else}
	<p class="card">{$_('lists.none')}</p>
{/if}

<style>
	div {
		display: flex;
		justify-content: space-between;
		margin: 0.5rem auto;
	}
</style>
