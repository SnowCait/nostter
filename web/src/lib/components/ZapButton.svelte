<script lang="ts">
	import type { Event } from 'nostr-typedef';
	import { metadataStore } from '$lib/cache/Events';
	import { metadataReqEmit } from '$lib/timelines/MainTimeline';
	import ZapDialog from './ZapDialog.svelte';
	import IconBolt from '@tabler/icons-svelte/dist/svelte/icons/IconBolt.svelte';

	export let pubkey: string;
	export let event: Event | undefined = undefined;
	export let size: number = 24;

	$: metadata = $metadataStore.get(pubkey);
	$: if (metadata === undefined) {
		console.debug('[metadata undefined]', pubkey);
		metadataReqEmit([pubkey]);
	}

	let zapDialogComponent: ZapDialog | undefined;
</script>

<button
	class="clear"
	disabled={!metadata?.canZap}
	on:click={() => zapDialogComponent?.openZapDialog()}
>
	<IconBolt {size} />
</button>
<ZapDialog {pubkey} {event} bind:this={zapDialogComponent} />

<style>
	button {
		color: var(--orange);
	}

	button:disabled {
		color: var(--accent-gray);
		cursor: initial;
	}
</style>
