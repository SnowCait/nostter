<script lang="ts">
	import { _ } from 'svelte-i18n';
	import type * as Nostr from 'nostr-typedef';
	import { getEventAddress } from '$lib/nostr/protocol/event-address';
	import {
		addToEmojiList,
		customEmojiListEvent,
		removeFromEmojiList
	} from '$lib/author/CustomEmojis';
	import { auth } from '$lib/auth.svelte';
	import type { Signer } from '$lib/nostr/signing/signer';
	import IconStar from '@tabler/icons-svelte-runes/icons/star';
	import IconStarFilled from '@tabler/icons-svelte-runes/icons/star-filled';

	interface Props {
		event: Nostr.Event;
	}

	let { event }: Props = $props();
	let address = $derived(getEventAddress(event));
	let registered = $derived(
		$customEmojiListEvent?.tags.some((tag) => tag[0] === 'a' && tag[1] === address) ?? false
	);
	let processing = $state(false);

	async function signEvent(template: Parameters<Signer['signEvent']>[0]) {
		const signer = auth.signer;
		if (signer === undefined) {
			throw new Error('Cannot sign an event without a signing session');
		}

		return signer.signEvent(template);
	}

	async function toggle(): Promise<void> {
		if (processing) return;

		processing = true;
		try {
			if (registered) {
				await removeFromEmojiList(signEvent, address);
			} else {
				await addToEmojiList(signEvent, address);
			}
		} catch {
			alert($_('emoji.custom.failed'));
		} finally {
			processing = false;
		}
	}
</script>

<button
	type="button"
	class="clear"
	aria-label={$_(registered ? 'emoji.custom.remove' : 'emoji.custom.add')}
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
	}
</style>
