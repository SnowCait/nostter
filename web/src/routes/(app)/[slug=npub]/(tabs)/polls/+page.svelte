<script lang="ts">
	import type { LayoutProps } from '../$types';
	import { referencesReqEmit, rxNostr } from '$lib/timelines/MainTimeline';
	import { createRxBackwardReq, uniq } from 'rx-nostr';
	import { Poll } from 'nostr-tools/kinds';
	import type * as Nostr from 'nostr-typedef';
	import { insertEventIntoDescendingList } from 'nostr-tools/utils';
	import { isMuteEvent } from '$lib/stores/Author';
	import EventComponent from '$lib/components/items/EventComponent.svelte';
	import { EventItem } from '$lib/Items';
	import { filter, type Subscription, tap } from 'rxjs';
	import { onDestroy } from 'svelte';
	import ProfileTabs from '../ProfileTabs.svelte';
	import { page } from '$app/state';

	const { data }: LayoutProps = $props();

	let slug = $derived(page.params.slug!);

	const limit = 50;
	const events = $state<Nostr.Event[]>([]);

	let subscription: Subscription | undefined;

	$effect(() => {
		const { pubkey } = data;
		const req = createRxBackwardReq();
		subscription = rxNostr
			.use(req)
			.pipe(
				uniq(),
				filter(({ event }) => !events.some((e) => e.id === event.id)),
				filter(({ event }) => !isMuteEvent(event)),
				tap(({ event }) => referencesReqEmit(event))
			)
			.subscribe(({ event }) => insertEventIntoDescendingList(events, event));
		req.emit([{ kinds: [Poll], authors: [pubkey], limit }]);
		req.over();
	});

	onDestroy(() => {
		subscription?.unsubscribe();
	});
</script>

<ProfileTabs tab="polls" {slug} />

<section class="card polls">
	{#each events.slice(0, limit) as event (event.id)}
		{@const item = new EventItem(event)}
		<div>
			<EventComponent {item} readonly={false} />
		</div>
	{/each}
</section>

<style>
	section.polls {
		margin: 0;
		padding: 0;
	}

	section.polls div {
		border-bottom: var(--default-border);

		overflow-x: hidden;
		text-overflow: ellipsis;
	}
</style>
