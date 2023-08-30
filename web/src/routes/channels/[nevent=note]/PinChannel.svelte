<script lang="ts">
	import { createRxNostr, createRxOneshotReq, latest, now } from 'rx-nostr';
	import { every, firstValueFrom, EmptyError } from 'rxjs';
	import { onDestroy } from 'svelte';
	import type { Kind, EventTemplate } from 'nostr-tools';
	import { Signer } from '$lib/Signer';
	import { pubkey, writeRelays } from '../../../stores/Author';
	import IconPin from '@tabler/icons-svelte/dist/svelte/icons/IconPin.svelte';
	import IconPinnedFilled from '@tabler/icons-svelte/dist/svelte/icons/IconPinnedFilled.svelte';

	export let channelId: string;

	let pinned = false;

	const rxNostr = createRxNostr();

	async function pin() {
		console.log('[channel pin]', channelId);

		pinned = true;

		await rxNostr.switchRelays($writeRelays);
		const pinReq = createRxOneshotReq({
			filters: { kinds: [10001], authors: [$pubkey], limit: 1 }
		});
		let event: EventTemplate;
		try {
			const packet = await firstValueFrom(rxNostr.use(pinReq).pipe(latest()));
			console.log('[channel pin latest]', packet);

			if (
				packet.event.tags.some(
					([tagName, id]: [string, string]) => tagName === 'e' && id === channelId
				)
			) {
				console.log('[channel pin already]', packet.event);
				return;
			}

			event = {
				kind: packet.event.kind,
				content: packet.event.content,
				tags: [...packet.event.tags, ['e', channelId]],
				created_at: now()
			};
		} catch (error) {
			if (error instanceof EmptyError) {
				console.log('[channel pin not found]', error);
				event = {
					kind: 10001 as Kind,
					content: '',
					tags: [['e', channelId]],
					created_at: now()
				};
			} else {
				pinned = false;
				throw error;
			}
		}

		console.log('[channel pin event]', event);
		const observable = rxNostr.send(await Signer.signEvent(event));
		observable.subscribe((packet) => {
			console.log('[send]', packet);
		});
		observable.pipe(every((packet) => !packet.ok)).subscribe((failed) => {
			console.log('[channel pinned]', !failed);
			if (failed) {
				console.error('[channel pin failed]');
				pinned = false;
			}
		});
	}

	async function unpin() {
		console.log('[channel unpin]', channelId);

		pinned = false;

		await rxNostr.switchRelays($writeRelays);
		const pinReq = createRxOneshotReq({
			filters: { kinds: [10001], authors: [$pubkey], limit: 1 }
		});
		let event: EventTemplate;
		try {
			const packet = await firstValueFrom(rxNostr.use(pinReq).pipe(latest()));
			console.log('[channel pin latest]', packet);

			if (
				!packet.event.tags.some(
					([tagName, id]: [string, string]) => tagName === 'e' && id === channelId
				)
			) {
				console.log('[channel unpin already]', packet.event);
				return;
			}

			// Save kind 10001 with new created_at even if empty tags because kind 5 may remain outdated kind 10001
			event = {
				kind: packet.event.kind,
				content: packet.event.content,
				tags: packet.event.tags.filter(
					([tagName, id]: [string, string]) => !(tagName === 'e' && id === channelId)
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

		console.log('[channel unpin event]', event);
		const observable = rxNostr.send(await Signer.signEvent(event));
		observable.subscribe((packet) => {
			console.log('[send]', packet);
		});
		observable.pipe(every((packet) => !packet.ok)).subscribe((failed) => {
			console.log('[channel pinned]', !failed);
			if (failed) {
				console.error('[channel unpin failed]');
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
