<script lang="ts">
	import QRCode from 'qrcode';
	import IconQrcode from '@tabler/icons-svelte-runes/icons/qrcode';
	import { Dialog } from 'bits-ui';

	interface Props {
		identifier: string;
	}

	let { identifier }: Props = $props();

	let nativeUrl = $derived(`nostr:${identifier}`);
	let webUrl = $derived(`web+nostr:${identifier}`);

	let open = $state(false);
</script>

<Dialog.Root bind:open>
	<Dialog.Trigger>
		{#snippet child({ props })}
			<button {...props} class="clear" aria-label="QR code"><IconQrcode /></button>
		{/snippet}
	</Dialog.Trigger>

	<Dialog.Portal>
		<Dialog.Overlay class="qrcode-overlay" />
		<Dialog.Content class="card qrcode-panel">
			<Dialog.Title class="qrcode-a11y">QR code</Dialog.Title>
			<Dialog.Description class="qrcode-a11y"
				>Open this Nostr identifier in a native or web app.</Dialog.Description
			>
			<div class="dialog-content">
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
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

<style>
	:global(.qrcode-overlay) {
		position: fixed;
		inset: 0;
		z-index: 1000;
		background: rgb(0 0 0 / 40%);
		cursor: default;
	}
	:global(.qrcode-panel) {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 1001;
		width: max-content;
		max-width: calc(100vw - 2rem);
		max-height: calc(100dvh - 2rem);
		border-radius: var(--radius);
		cursor: default;
	}
	:global(.qrcode-a11y) {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	.dialog-content {
		margin: 0.5rem;
	}

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
