<script lang="ts">
	import { page } from '$app/stores';
	import { metadataStore } from '$lib/cache/Events';
	import IconShare2 from '@tabler/icons-svelte/icons/share-2';
	import IconClipboard from '@tabler/icons-svelte/icons/clipboard';
	import IconClipboardCheck from '@tabler/icons-svelte/icons/clipboard-check';
	import { nip19 } from 'nostr-tools';
	import { copy } from '$lib/Clipboard';
	import { getSeenOnRelays } from '$lib/timelines/MainTimeline';

	export let pubkey: string;
	export let size: number = 24;
	export let width = '34px';
	export let height = '34px';

	let visited = false;

	$: metadata = $metadataStore.get(pubkey);
	$: nprofile = nip19.nprofileEncode({
		pubkey,
		relays: metadata ? getSeenOnRelays(metadata.event.id) : undefined
	});
	$: url = `${$page.url.origin}/${metadata?.normalizedNip05 ? metadata.normalizedNip05 : nprofile}`;
	$: data = { url };
</script>

{#if navigator.canShare !== undefined && navigator.canShare(data)}
	<button
		class="clear"
		on:click={() => navigator.share(data)}
		style="width: {width}; height: {height}"
	>
		<IconShare2 {size} />
	</button>
{:else}
	<button
		class="clear"
		on:click={() => {
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
