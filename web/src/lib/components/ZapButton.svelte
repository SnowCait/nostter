<script lang="ts">
	import { metadataStore } from '$lib/cache/Events';
	import { metadataReqEmit } from '$lib/timelines/MainTimeline';
	import type { Signer } from '$lib/nostr/signing/signer';
	import ZapDialog from './ZapDialog.svelte';
	import IconBolt from '@tabler/icons-svelte-runes/icons/bolt';

	interface Props {
		pubkey: string;
		size?: number;
		width?: string;
		height?: string;
		signEvent: Signer['signEvent'];
	}

	let { pubkey, size = 24, width = '34px', height = '34px', signEvent }: Props = $props();

	let metadata = $derived($metadataStore.get(pubkey));
	$effect(() => {
		if (metadata === undefined) {
			void metadataReqEmit([pubkey]);
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
<ZapDialog {pubkey} {signEvent} bind:this={zapDialogComponent} />

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
