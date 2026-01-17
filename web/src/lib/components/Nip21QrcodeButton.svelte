<script lang="ts">
	import QRCode from 'qrcode';
	import IconQrcode from '@tabler/icons-svelte/icons/qrcode';
	import ModalDialog from './ModalDialog.svelte';

	interface Props {
		identifier: string;
	}

	let { identifier }: Props = $props();

	let nativeUrl = $derived(`nostr:${identifier}`);
	let webUrl = $derived(`web+nostr:${identifier}`);

	let open = $state(false);
</script>

<button class="clear" onclick={() => (open = true)}>
	<IconQrcode />
</button>

<ModalDialog bind:open>
	<article>
		<section>
			<h3>Native app</h3>
			{#await QRCode.toDataURL(nativeUrl) then dataUrl}
				<img src={dataUrl} alt={nativeUrl} />
			{/await}
		</section>
		<section>
			<h3>Web app</h3>
			{#await QRCode.toDataURL(webUrl) then dataUrl}
				<img src={dataUrl} alt={webUrl} />
			{/await}
		</section>
	</article>
</ModalDialog>

<style>
	button {
		width: 24px;
		height: 24px;
		color: var(--foreground);
	}

	article {
		display: flex;
		flex-direction: row;
		flex-wrap: wrap;
	}

	section {
		margin: auto;
	}

	h3 {
		text-align: center;
	}
</style>
