<script lang="ts">
	import { createRxNostr, createRxOneshotReq, latest, uniq } from 'rx-nostr';
	import { error } from '@sveltejs/kit';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/stores';
	import { WebStorage } from '$lib/WebStorage';
	import { EventItem } from '$lib/Items';
	import { User as UserDecoder } from '$lib/User';
	import { pubkey as authorPubkey, readRelays } from '../../../../stores/Author';
	import type { Event } from 'nostr-tools';
	import { onDestroy } from 'svelte';
	import { firstValueFrom, EmptyError } from 'rxjs';
	import TimelineView from '../../TimelineView.svelte';

	let items: EventItem[] = [];

	const rxNostr = createRxNostr();

	afterNavigate(async () => {
		const slug = $page.params.slug;
		console.log('[pin page]', slug);

		const { pubkey, relays } = await UserDecoder.decode(slug);

		if (pubkey === undefined) {
			throw error(404);
		}

		await rxNostr.switchRelays([...$readRelays, ...relays]);

		let event: Event | undefined;
		if (pubkey === $authorPubkey) {
			const storage = new WebStorage(localStorage);
			event = storage.getReplaceableEvent(10001);
			console.log('[pin event (author)]', event);
		} else {
			try {
				const pinReq = createRxOneshotReq({
					filters: { kinds: [10001], authors: [pubkey], limit: 1 }
				});
				const packet = await firstValueFrom(rxNostr.use(pinReq).pipe(latest()));
				console.log('[pin event]', packet);
				event = packet.event;
			} catch (error) {
				if (!(error instanceof EmptyError)) {
					throw error;
				}
			}
		}

		if (event === undefined) {
			return;
		}

		const referenceReq = createRxOneshotReq({
			filters: { ids: event.tags.filter(([tagName]) => tagName === 'e').map(([, id]) => id) }
		});
		rxNostr
			.use(referenceReq)
			.pipe(uniq())
			.subscribe((packet) => {
				console.log('[pin e tag]', packet);
				items.push(new EventItem(packet.event));
				items = items;
			});
	});

	onDestroy(() => {
		rxNostr.dispose();
	});
</script>

<h1>PINs</h1>

<TimelineView {items} load={async () => console.debug()} showLoading={false} />
