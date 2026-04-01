<script lang="ts">
	import { _ } from 'svelte-i18n';
	import type { LayoutProps } from '../$types';
	import { referencesReqEmit, rxNostr } from '$lib/timelines/MainTimeline';
	import { createRxBackwardReq, uniq } from 'rx-nostr';
	import { Poll } from 'nostr-tools/kinds';
	import type { Event } from 'nostr-typedef';
	import { insertEventIntoDescendingList } from 'nostr-tools/utils';
	import { isMuteEvent } from '$lib/stores/Author';
	import EventComponent from '$lib/components/items/EventComponent.svelte';
	import { EventItem } from '$lib/Items';
	import { filter, Subscription, tap } from 'rxjs';
	import { onDestroy } from 'svelte';

	const { data }: LayoutProps = $props();

	const limit = 50;
	const events = $state<Event[]>([]);

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

<h1>{$_('poll.title')}</h1>
<section class="card">
	{#each events.slice(0, limit) as event (event.id)}
		{@const item = new EventItem(event)}
		<div>
			<EventComponent {item} readonly={false} />
		</div>
	{/each}
</section>

<style>
	section {
		margin: 0;
		padding: 0;
	}

	section div {
		border-bottom: var(--default-border);

		overflow-x: hidden;
		text-overflow: ellipsis;
	}
</style>
