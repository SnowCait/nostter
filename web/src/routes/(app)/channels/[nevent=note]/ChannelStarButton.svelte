<script lang="ts">
	import { _ } from 'svelte-i18n';
	import IconStar from '@tabler/icons-svelte-runes/icons/star';
	import IconStarFilled from '@tabler/icons-svelte-runes/icons/star-filled';
	import { authorChannelsEventStore } from '$lib/cache/Events';
	import { auth } from '$lib/auth.svelte';
	import type { Signer } from '$lib/nostr/signing/signer';
	import { pinChannel, unpinChannel } from './Pin';

	interface Props {
		channelId: string;
	}

	let { channelId }: Props = $props();
	let registered = $derived(
		$authorChannelsEventStore?.tags.some(
			([tagName, id]) => tagName === 'e' && id === channelId
		) ?? false
	);
	let processing = $state(false);

	async function toggle(): Promise<void> {
		if (processing) return;

		const signer = auth.signer;
		if (signer === undefined) return;

		processing = true;
		try {
			const signEvent: Signer['signEvent'] = (template) => signer.signEvent(template);
			if (registered) {
				await unpinChannel(channelId, signEvent);
			} else {
				await pinChannel(channelId, signEvent);
			}
		} catch {
			alert($_('channel_list.failed'));
		} finally {
			processing = false;
		}
	}
</script>

<button
	type="button"
	class="clear"
	class:registered
	aria-label={$_(registered ? 'channel_list.remove' : 'channel_list.add')}
	disabled={processing}
	onclick={toggle}
>
	{#if registered}
		<IconStarFilled size={20} />
	{:else}
		<IconStar size={20} />
	{/if}
</button>

<style>
	button {
		color: var(--accent-gray);
		flex-shrink: 0;
	}

	button.registered {
		color: var(--gold);
	}
</style>
