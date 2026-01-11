<script lang="ts">
	import { page } from '$app/stores';
	import { metadataStore } from '$lib/cache/Events';
	import IconShare2 from '@tabler/icons-svelte/icons/share-2';
	import IconClipboard from '@tabler/icons-svelte/icons/clipboard';
	import IconClipboardCheck from '@tabler/icons-svelte/icons/clipboard-check';
	import { nip19 } from 'nostr-tools';
	import { copy } from '$lib/Clipboard';
	import { getSeenOnRelays } from '$lib/timelines/MainTimeline';

	interface Props {
		pubkey: string;
		size?: number;
		width?: string;
		height?: string;
	}

	let {
		pubkey,
		size = 24,
		width = '34px',
		height = '34px'
	}: Props = $props();

	let visited = $state(false);

	let metadata = $derived($metadataStore.get(pubkey));
	let nprofile = $derived(nip19.nprofileEncode({
		pubkey,
		relays: metadata ? getSeenOnRelays(metadata.event.id) : undefined
	}));
	let url = $derived(`${$page.url.origin}/${metadata?.normalizedNip05 ? metadata.normalizedNip05 : nprofile}`);
	let data = $derived({ url });
</script>

{#if navigator.canShare !== undefined && navigator.canShare(data)}
	<button
		class="clear"
		onclick={() => navigator.share(data)}
		style="width: {width}; height: {height}"
	>
		<IconShare2 {size} />
	</button>
{:else}
	<button
		class="clear"
		onclick={() => {
			copy(url);
			visited = true;
		}}
		style="width: {width}; height: {height}"
	>
		{#if visited}
			<IconClipboardCheck {size} />
		{:else}
			<IconClipboard {size} />
		{/if}
	</button>
{/if}

<style>
	button {
		color: var(--accent-gray);
		padding: 5px;
	}
</style>
