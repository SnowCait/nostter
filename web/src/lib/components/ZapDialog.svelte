<script lang="ts">
	import { nip57 } from 'nostr-tools';
	import { buildZapInvoiceUrl } from '@nostter/nostr-protocol';
	import QRCode from 'qrcode';
	import IconBolt from '@tabler/icons-svelte-runes/icons/bolt';
	import IconInfoCircle from '@tabler/icons-svelte-runes/icons/info-circle';
	import IconHelpCircle from '@tabler/icons-svelte-runes/icons/help-circle';
	import { rxNostr } from '$lib/relay-client';
	import { persistedStore } from '$lib/platform/storage/persisted-store';
	import { WebStorage } from '$lib/WebStorage';
	import { copy } from '$lib/platform/browser/clipboard';
	import type { Signer } from '$lib/nostr/signing/signer';
	import { zapWithWalletConnect, type NwcPaymentResult } from '$lib/Zap';
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
		helpOpen = false;
		if (!sending) {
			invoice = '';
			invoiceError = undefined;
			invoiceDetails = undefined;
			paymentResult = undefined;
			comment = '';
			sats = $history.at(0) ?? 1;
		}
		open = true;
	}

	const history = persistedStore<number[]>('zap:history', []);

	let sats = $state($history.at(0) ?? 1);
	let satsList: number[] = $state([]);
	let comment = $state('');
	let invoice = $state('');
	let open = $state(false);
	let sending = $state(false);
	let helpOpen = $state(false);
	let paymentResult = $state<NwcPaymentResult>();
	type InvoiceError = 'signing' | 'url' | 'network' | 'http' | 'json' | 'invalid';
	let invoiceError = $state<InvoiceError>();
	let invoiceDetails = $state<string>();

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
		paymentResult = undefined;
		invoiceError = undefined;
		invoiceDetails = undefined;
		try {
			let zapInvoice: string;
			let stage: InvoiceError = 'signing';
			let callback: string | undefined;
			let status: number | undefined;
			let contentType: string | null = null;
			let body: string | undefined;
			try {
				const amount = sats * 1000;
				const relays = Object.keys(rxNostr.getDefaultRelays({ filter: 'write-all' }));
				const zapRequest = nip57.makeZapRequest(
					item === undefined
						? { pubkey, amount, comment, relays }
						: { event: item.event, amount, comment, relays }
				);
				const zapRequestEvent = await signEvent(zapRequest);
				stage = 'url';
				const zapUrl = await metadata?.zapUrl();
				if (!zapUrl) {
					throw new Error('Zap URL not found');
				}
				callback = zapUrl.href;
				const requestUrl = buildZapInvoiceUrl(zapUrl, amount, zapRequestEvent);
				stage = 'network';
				const response = await fetch(requestUrl);
				stage = 'http';
				status = response.status;
				if (response.ok) {
					stage = 'json';
				}
				contentType = response.headers.get('content-type');
				body = await response.text();
				if (!response.ok) {
					throw new Error('Invoice endpoint returned an HTTP error');
				}
				stage = 'json';
				const payment = JSON.parse(body);
				stage = 'invalid';
				if (typeof payment?.pr !== 'string' || payment.pr.trim() === '') {
					throw new Error('Invoice response has no non-empty pr');
				}
				zapInvoice = payment.pr;
			} catch (error) {
				console.error('[zap invoice failed]', stage, error);
				invoiceDetails = [
					`Stage: ${stage}`,
					error instanceof Error ? `${error.name}: ${error.message}` : String(error),
					callback && `Callback URL: ${callback}`,
					status !== undefined && `HTTP status: ${status}`,
					contentType && `Content-Type: ${contentType}`,
					body !== undefined && `Response body:\n${body}`
				]
					.filter(
						(value) =>
							value !== false && value !== undefined && value !== null && value !== ''
					)
					.join('\n');
				invoiceError = stage;
				return;
			}

			if (!open) {
				return;
			}

			$history = [sats, ...$history].slice(0, 100);
			const storage = new WebStorage(localStorage);
			const walletConnectUri = storage.get('nostr-wallet-connect');
			if (walletConnectUri !== null && walletConnectUri !== '') {
				try {
					const result = await zapWithWalletConnect(walletConnectUri, zapInvoice);
					if (result.status === 'success') {
						open = false;
						onZapped?.();
						return;
					}
					paymentResult = result;
				} catch (error) {
					console.error('[NWC error]', error);
					paymentResult = { status: 'unknown' };
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
		<div class="title">
			<span aria-hidden="true"><IconBolt size={20} /></span>
			<h1>{$_('zap.title')}</h1>
			<button
				type="button"
				class="help-toggle"
				aria-label={$_('zap.help.toggle')}
				aria-expanded={helpOpen}
				onclick={() => (helpOpen = !helpOpen)}
			>
				<IconHelpCircle size={22} />
			</button>
		</div>
		{#if helpOpen}
			<aside class="help">
				<h2>
					<span aria-hidden="true"><IconInfoCircle size={18} /></span>
					{$_('zap.help.title')}
				</h2>
				<p>{$_('zap.help.description')}</p>
				<p>{$_('zap.help.support')}</p>
			</aside>
		{/if}
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
					<details>
						<summary>{$_('zap.errorDetails')}</summary>
						<pre>{invoiceDetails}</pre>
						<button type="button" onclick={() => invoiceDetails && copy(invoiceDetails)}
							>{$_('zap.copyDetails')}</button
						>
					</details>
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
				{#if paymentResult?.status === 'unknown'}
					<p role="alert">{$_('zap.paymentUnknown')}</p>
				{:else if paymentResult?.status === 'failed'}
					<p role="alert">
						{paymentResult.message?.trim()
							? paymentResult.message
							: $_('zap.paymentFailed')}
					</p>
				{/if}
				<div>
					{#await QRCode.toDataURL(url) then dataUrl}
						<a href={url} target="_blank" rel="noopener noreferrer">
							<img src={dataUrl} alt="" />
						</a>
					{/await}
				</div>
				<div class="text">{invoice}</div>
				{#if paymentResult?.status !== 'unknown'}
					<iframe src={url} title="Lightning" width="0" height="0"></iframe>
				{/if}
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

	.title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.title h1 {
		margin: 0;
	}

	.title > span,
	.help h2 > span {
		display: inline-flex;
		flex: none;
	}

	.help-toggle {
		width: 44px;
		height: 44px;
		margin-left: auto;
		flex-shrink: 0;
		padding: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		color: var(--secondary-accent);
		border-radius: var(--radius);
	}

	.help-toggle:hover {
		background: transparent;
		color: var(--foreground);
		opacity: 1;
	}

	.help-toggle:focus-visible {
		outline: 2px solid var(--ring);
		outline-offset: 2px;
	}

	.help {
		max-width: 36rem;
		margin: 0.75rem 0 1rem;
		padding: 1rem;
		border-radius: var(--radius);
		background: var(--accent-surface-low);
	}

	.help h2 {
		margin: 0 0 0.5rem;
		font-size: 1rem;
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.help p {
		margin: 0;
		line-height: 1.55;
	}

	.help p + p {
		margin-top: 0.5rem;
	}

	details {
		min-width: 0;
		max-width: 100%;
	}

	details pre {
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		max-height: 20rem;
		overflow: auto;
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
