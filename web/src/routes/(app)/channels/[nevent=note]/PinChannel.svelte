<script lang="ts">
	import { createRxNostr, createRxOneshotReq, latest, now } from 'rx-nostr';
	import { every, firstValueFrom, EmptyError } from 'rxjs';
	import { onDestroy } from 'svelte';
	import type { Kind, EventTemplate } from 'nostr-tools';
	import { authorChannelsEventStore } from '$lib/cache/Events';
	import { Signer } from '$lib/Signer';
	import { pubkey, writeRelays } from '$lib/stores/Author';
	import IconPin from '@tabler/icons-svelte/dist/svelte/icons/IconPin.svelte';
	import IconPinnedFilled from '@tabler/icons-svelte/dist/svelte/icons/IconPinnedFilled.svelte';

	export let channelId: string;

	let pinned =
		$authorChannelsEventStore?.tags.some(
			([tagName, id]) => tagName === 'e' && id === channelId
		) ?? false;

	const rxNostr = createRxNostr();

	async function pin() {
		console.log('[channel pin]', channelId);

		pinned = true;

		rxNostr.setDefaultRelays($writeRelays);
		const pinReq = createRxOneshotReq({
			filters: { kinds: [10005], authors: [$pubkey], limit: 1 }
		});
		let unsignedEvent: EventTemplate;
		try {
			const packet = await firstValueFrom(rxNostr.use(pinReq).pipe(latest()));
			console.log('[channel pin latest]', packet);

			if (packet.event.tags.some(([tagName, id]) => tagName === 'e' && id === channelId)) {
				console.log('[channel pin already]', packet.event);
				return;
			}

			unsignedEvent = {
				kind: packet.event.kind,
				content: packet.event.content,
				tags: [...packet.event.tags, ['e', channelId]],
				created_at: now()
			};
		} catch (error) {
			if (error instanceof EmptyError) {
				console.log('[channel pin not found]', error);
				unsignedEvent = {
					kind: 10005 as Kind,
					content: '',
					tags: [['e', channelId]],
					created_at: now()
				};
			} else {
				pinned = false;
				throw error;
			}
		}

		const event = await Signer.signEvent(unsignedEvent);
		console.log('[channel pin event]', event);
		const observable = rxNostr.send(event);
		observable.subscribe((packet) => {
			console.log('[send]', packet);
			if (packet.ok && $authorChannelsEventStore?.id !== event.id) {
				$authorChannelsEventStore = event;
			}
		});
		observable.pipe(every((packet) => !packet.ok)).subscribe((failed) => {
			console.log('[channel pinned]', !failed);
			if (failed) {
				console.error('[channel pin failed]');
				alert('Failed to pin.');
				pinned = false;
			}
		});
	}

	async function unpin() {
		console.log('[channel unpin]', channelId);

		pinned = false;

		rxNostr.setDefaultRelays($writeRelays);
		const pinReq = createRxOneshotReq({
			filters: { kinds: [10005], authors: [$pubkey], limit: 1 }
		});
		let unsignedEvent: EventTemplate;
		try {
			const packet = await firstValueFrom(rxNostr.use(pinReq).pipe(latest()));
			console.log('[channel pin latest]', packet);

			if (!packet.event.tags.some(([tagName, id]) => tagName === 'e' && id === channelId)) {
				console.log('[channel unpin already]', packet.event);
				return;
			}

			// Save kind 10005 with new created_at even if empty tags because kind 5 may remain outdated kind 10005
			unsignedEvent = {
				kind: packet.event.kind,
				content: packet.event.content,
				tags: packet.event.tags.filter(
					([tagName, id]) => !(tagName === 'e' && id === channelId)
				),
				created_at: now()
			};
		} catch (error) {
			if (error instanceof EmptyError) {
				console.log('[channel unpin already]', error);
				return;
			} else {
				pinned = true;
				throw error;
			}
		}

		const event = await Signer.signEvent(unsignedEvent);
		console.log('[channel unpin event]', event);
		const observable = rxNostr.send(event);
		observable.subscribe((packet) => {
			console.log('[send]', packet);
			if (packet.ok && $authorChannelsEventStore?.id !== event.id) {
				$authorChannelsEventStore = event;
			}
		});
		observable.pipe(every((packet) => !packet.ok)).subscribe((failed) => {
			console.log('[channel pinned]', !failed);
			if (failed) {
				console.error('[channel unpin failed]');
				alert('Failed to unpin.');
				pinned = true;
			}
		});
	}

	onDestroy(async () => {
		console.log('[channel pin on destroy]');
		rxNostr.dispose();
	});
</script>

{#if pinned}
	<button class="clear" on:click={unpin}><IconPinnedFilled /></button>
{:else}
	<button class="clear" on:click={pin}><IconPin /></button>
{/if}

<style>
	button {
		color: var(--accent-gray);
	}
</style>
