<script lang="ts">
	import { createRxNostr, createRxOneshotReq, latest, uniq } from 'rx-nostr';
	import { error } from '@sveltejs/kit';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/stores';
	import { User as UserDecoder } from '$lib/User';
	import { pubkey as authorPubkey, readRelays } from '../../../stores/Author';
	import { authorReplaceableEvents } from '$lib/cache/Events';
	import type { Event } from 'nostr-tools';
	import { onDestroy } from 'svelte';
	import { firstValueFrom, EmptyError } from 'rxjs';
	import TimelineView from '../../TimelineView.svelte';
	import type { UserEvent } from '../../types';

	let events: UserEvent[] = [];

	const rxNostr = createRxNostr();

	afterNavigate(async () => {
		const slug = $page.params.npub;
		console.log('[pin page]', slug);

		const { pubkey, relays } = await UserDecoder.decode(slug);

		if (pubkey === undefined) {
			throw error(404);
		}

		await rxNostr.switchRelays([...$readRelays, ...relays]);

		let event: Event | undefined;
		if (pubkey === $authorPubkey) {
			event = authorReplaceableEvents.get(10001);
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
				events.push(packet.event);
				events = events;
			});
	});

	onDestroy(() => {
		rxNostr.dispose();
	});
</script>

<h1>PINs</h1>

<TimelineView {events} load={async () => console.debug()} showLoading={false} />
