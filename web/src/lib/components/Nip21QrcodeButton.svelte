<script lang="ts">
	import QRCode from 'qrcode';
	import IconQrcode from '@tabler/icons-svelte/icons/qrcode';
	import ModalDialog from './ModalDialog.svelte';

	export let identifier: string;

	$: nativeUrl = `nostr:${identifier}`;
	$: webUrl = `web+nostr:${identifier}`;

	let open: boolean;
</script>

<button class="clear" on:click={() => (open = true)}>
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
