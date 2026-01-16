<script lang="ts">
	import { run } from 'svelte/legacy';

	import type { Event } from 'nostr-typedef';
	import { metadataStore } from '$lib/cache/Events';
	import { metadataReqEmit } from '$lib/timelines/MainTimeline';
	import ZapDialog from './ZapDialog.svelte';
	import IconBolt from '@tabler/icons-svelte/icons/bolt';

	interface Props {
		pubkey: string;
		event?: Event | undefined;
		size?: number;
		width?: string;
		height?: string;
	}

	let { pubkey, event = undefined, size = 24, width = '34px', height = '34px' }: Props = $props();

	let metadata = $derived($metadataStore.get(pubkey));
	run(() => {
		if (metadata === undefined) {
			console.debug('[metadata undefined]', pubkey);
			metadataReqEmit([pubkey]);
		}
	});

	let zapDialogComponent: ZapDialog | undefined = $state();
</script>

<button
	class="clear"
	disabled={!metadata?.canZap}
	onclick={() => zapDialogComponent?.openZapDialog()}
	style="width: {width}; height: {height}"
>
	<IconBolt {size} />
</button>
<ZapDialog {pubkey} {event} bind:this={zapDialogComponent} />

<style>
	button {
		color: var(--orange);
		padding: 5px;
	}

	button:disabled {
		color: var(--accent-gray);
		cursor: initial;
	}
</style>
