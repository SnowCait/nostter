<script lang="ts">
	import { InvoiceRequest } from '$lib/features/zap/application/invoice-request.svelte';
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
	const request = new InvoiceRequest();

	$effect(() => {
		const counts = new Map<number, number>();
		for (const value of $history) {
			counts.set(value, (counts.get(value) ?? 0) + 1);
		}
		satsList = [...counts].toSorted(([, x], [, y]) => y - x).map(([value]) => value);
	});

	async function zap(e: SubmitEvent) {
		e.preventDefault();

		await request.send({
			amount: sats * 1000,
			createRequest: async () => {
				const amount = sats * 1000;
				const relays = Object.keys(rxNostr.getDefaultRelays({ filter: 'write-all' }));
				const zapRequest = nip57.makeZapRequest(
					item === undefined
						? { pubkey, amount, comment, relays }
						: { event: item.event, amount, comment, relays }
				);
				return await signEvent(zapRequest);
			},
			getZapUrl: async () => await metadata?.zapUrl(),
			onInvoice: async (zapInvoice) => {
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
			}
		});
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
			<form onsubmit={zap} aria-busy={request.sending}>
				{#if request.error}
					<p role="alert">{$_(`zap.errors.${request.error}`)}</p>
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
				<input type="submit" value={$_('zap.send')} disabled={request.sending} />
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
