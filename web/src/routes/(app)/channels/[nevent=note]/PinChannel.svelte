<script lang="ts">
	import { createRxOneshotReq, latest, now } from 'rx-nostr';
	import { every, firstValueFrom, EmptyError } from 'rxjs';
	import type { EventTemplate } from 'nostr-tools';
	import { authorChannelsEventStore } from '$lib/cache/Events';
	import { Signer } from '$lib/Signer';
	import { pubkey } from '$lib/stores/Author';
	import { rxNostr } from '$lib/timelines/MainTimeline';
	import IconPin from '@tabler/icons-svelte/icons/pin';
	import IconPinnedFilled from '@tabler/icons-svelte/icons/pinned-filled';

	export let channelId: string;

	let pinned =
		$authorChannelsEventStore?.tags.some(
			([tagName, id]) => tagName === 'e' && id === channelId
		) ?? false;

	async function pin() {
		console.log('[channel pin]', channelId);

		pinned = true;

		const pinReq = createRxOneshotReq({
			filters: { kinds: [10005], authors: [$pubkey], limit: 1 }
		});
		let unsignedEvent: EventTemplate;
		try {
			const packet = await firstValueFrom(rxNostr.use(pinReq).pipe(latest()));
			console.debug('[channel pin latest]', packet);

			if (packet.event.tags.some(([tagName, id]) => tagName === 'e' && id === channelId)) {
				console.debug('[channel pin already]', packet.event);
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
				console.debug('[channel pin not found]', error);
				unsignedEvent = {
					kind: 10005,
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
		console.debug('[channel pin event]', event);
		const observable = rxNostr.send(event);
		observable.subscribe((packet) => {
			console.debug('[channel pin send]', packet);
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

		const pinReq = createRxOneshotReq({
			filters: { kinds: [10005], authors: [$pubkey], limit: 1 }
		});
		let unsignedEvent: EventTemplate;
		try {
			const packet = await firstValueFrom(rxNostr.use(pinReq).pipe(latest()));
			console.debug('[channel pin latest]', packet);

			if (!packet.event.tags.some(([tagName, id]) => tagName === 'e' && id === channelId)) {
				console.debug('[channel unpin already]', packet.event);
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
				console.debug('[channel unpin already]', error);
				return;
			} else {
				pinned = true;
				throw error;
			}
		}

		const event = await Signer.signEvent(unsignedEvent);
		console.debug('[channel unpin event]', event);
		const observable = rxNostr.send(event);
		observable.subscribe((packet) => {
			console.debug('[channel unpin send]', packet);
			if (packet.ok && $authorChannelsEventStore?.id !== event.id) {
				$authorChannelsEventStore = event;
			}
		});
		observable.pipe(every((packet) => !packet.ok)).subscribe((failed) => {
			console.log('[channel unpinned]', !failed);
			if (failed) {
				console.error('[channel unpin failed]');
				alert('Failed to unpin.');
				pinned = true;
			}
		});
	}
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
