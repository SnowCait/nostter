<script lang="ts">
	import { nip57 } from 'nostr-tools';
	import QRCode from 'qrcode';
	import { rxNostr } from '$lib/relay-client';
	import { persistedStore } from '$lib/platform/storage/persisted-store';
	import { WebStorage } from '$lib/WebStorage';
	import type { Signer } from '$lib/nostr/signing/signer';
	import { zapWithWalletConnect } from '$lib/Zap';
	import { metadataStore } from '$lib/cache/Events';
	import ModalDialog from '$lib/components/ModalDialog.svelte';
	import { EventItem } from '$lib/Items';
	import EventComponent from './items/EventComponent.svelte';
	import ProfileIcon from './profile/ProfileIcon.svelte';
	import ProfileName from './profile/ProfileName.svelte';
	import { _ } from 'svelte-i18n';

	interface Props {
		pubkey: string;
		item?: EventItem | undefined;
		onZapped?: () => void;
		signEvent: Signer['signEvent'];
	}

	let { pubkey, item, onZapped, signEvent }: Props = $props();

	let metadata = $derived($metadataStore.get(pubkey));

	export function openZapDialog() {
		console.debug('[zap open]');
		open = true;
	}

	const history = persistedStore<number[]>('zap:history', []);

	let sats = $state($history.at(0) ?? 1);
	let satsList: number[] = $state([]);
	let comment = $state('');
	let invoice = $state('');
	let open = $state(false);
	let sending = $state(false);
	type InvoiceError = 'signing' | 'url' | 'network' | 'http' | 'json' | 'invalid';
	let invoiceError = $state<InvoiceError>();

	$effect(() => {
		const counts = new Map<number, number>();
		for (const value of $history) {
			counts.set(value, (counts.get(value) ?? 0) + 1);
		}
		satsList = [...counts].toSorted(([, x], [, y]) => y - x).map(([value]) => value);
	});

	async function zap(e: SubmitEvent) {
		e.preventDefault();

		if (sending) {
			return;
		}
		sending = true;
		invoiceError = undefined;
		try {
			let zapInvoice: string;
			let stage: InvoiceError = 'signing';
			let detail: unknown;
			try {
				const amount = sats * 1000;
				const relays = Object.keys(rxNostr.getDefaultRelays({ filter: 'write-all' }));
				const zapRequest = nip57.makeZapRequest(
					item === undefined
						? { pubkey, amount, comment, relays }
						: { event: item.event, amount, comment, relays }
				);
				const zapRequestEvent = await signEvent(zapRequest);
				const encoded = encodeURI(JSON.stringify(zapRequestEvent));
				stage = 'url';
				detail = {
					pubkey,
					lud16: metadata?.content?.lud16,
					lud06: metadata?.content?.lud06
				};
				const zapUrl = await metadata?.zapUrl();
				if (!zapUrl) {
					throw new Error('Zap URL not found');
				}
				const endpoint = new URL(zapUrl);
				endpoint.search = '';
				endpoint.hash = '';
				detail = endpoint.href;
				stage = 'network';
				const response = await fetch(`${zapUrl.href}?amount=${amount}&nostr=${encoded}`);
				stage = 'http';
				if (!response.ok) {
					detail = {
						endpoint: detail,
						status: response.status,
						body: await response.text()
					};
					throw new Error('Invoice endpoint returned an HTTP error');
				}
				stage = 'json';
				const payment = await response.json();
				stage = 'invalid';
				detail = { endpoint: detail, response: payment };
				if (typeof payment?.pr !== 'string' || payment.pr.trim() === '') {
					throw new Error('Invoice response has no non-empty pr');
				}
				zapInvoice = payment.pr;
			} catch (error) {
				console.error('[zap invoice failed]', stage, error, detail);
				invoiceError = stage;
				return;
			}

			$history = [sats, ...$history].slice(0, 100);
			const storage = new WebStorage(localStorage);
			const walletConnectUri = storage.get('nostr-wallet-connect');
			if (walletConnectUri !== null && walletConnectUri !== '') {
				try {
					const success = await zapWithWalletConnect(walletConnectUri, zapInvoice);
					if (success) {
						open = false;
						onZapped?.();
						return;
					}
				} catch (error) {
					console.error('[NWC error]', error);
				}
			}
			invoice = zapInvoice;
			onZapped?.();
		} finally {
			sending = false;
		}
	}
</script>

<ModalDialog bind:open>
	<article>
		<h1>{$_('zap.title')}</h1>
		{#if invoice === ''}
			<blockquote>
				{#if item}
					<EventComponent {item} readonly={true} />
				{:else}
					<article class="profile timeline-item">
						<div>
							<ProfileIcon {pubkey} width="48px" height="48px" />
						</div>
						<div>
							<ProfileName {pubkey} />
						</div>
					</article>
				{/if}
			</blockquote>
			<form onsubmit={zap} aria-busy={sending}>
				{#if invoiceError}
					<p role="alert">{$_(`zap.errors.${invoiceError}`)}</p>
				{/if}
				<div class="sats-input">
					{#each satsList.slice(0, 5) as value}
						<button type="button" onclick={() => (sats = value)}>
							{value.toLocaleString()}
						</button>
					{/each}
				</div>
				<div>
					<input type="number" bind:value={sats} />
					<span>sats</span>
				</div>
				<div>
					<textarea placeholder={$_('zap.message')} bind:value={comment}></textarea>
				</div>
				<input type="submit" value={$_('zap.send')} disabled={sending} />
			</form>
		{:else}
			{@const url = `lightning:${invoice}`}
			<section class="lnbc">
				<div>
					{#await QRCode.toDataURL(url) then dataUrl}
						<a href={url} target="_blank" rel="noopener noreferrer">
							<img src={dataUrl} alt="" />
						</a>
					{/await}
				</div>
				<div class="text">{invoice}</div>
				<iframe src={url} title="Lightning" width="0" height="0"></iframe>
			</section>
		{/if}
	</article>
</ModalDialog>

<style>
	article {
		margin: 1rem;
	}

	h1 {
		font-size: 1.5rem;
	}

	.lnbc .text {
		max-width: 400px;
		overflow: auto;
	}

	.profile {
		padding: 0;
		vertical-align: middle;
		display: flex;
		gap: 12px;
	}

	.profile div:last-child {
		display: flex;
		align-items: center;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;

		margin-top: 1rem;
	}

	textarea {
		width: 100%;
		--input-font-size: 1rem;
		border: var(--default-border);
		min-height: 5rem;
	}

	input[type='number'] {
		--input-font-size: 1rem;
	}

	.sats-input {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.sats-input button {
		color: var(--foreground);
		background-color: var(--accent-surface);
	}
</style>
