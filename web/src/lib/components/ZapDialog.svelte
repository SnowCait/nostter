<script lang="ts">
	import { nip57 } from 'nostr-tools';
	import { onDestroy } from 'svelte';
	import { ZapSubmission } from '$lib/features/zap/application/zap-submission.svelte';
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
		submission.reset();
		comment = '';
		open = true;
	}

	const history = persistedStore<number[]>('zap:history', []);

	let sats = $state($history.at(0) ?? 1);
	let satsList: number[] = $state([]);
	let comment = $state('');
	const submission = new ZapSubmission();
	let invoice = $derived(submission.invoice);
	onDestroy(() => submission.reset());
	let open = $state(false);
	let sending = $derived(submission.sending);

	$effect(() => {
		const counts = new Map<number, number>();
		for (const value of $history) {
			counts.set(value, (counts.get(value) ?? 0) + 1);
		}
		satsList = [...counts].toSorted(([, x], [, y]) => y - x).map(([value]) => value);
	});

	async function zap(e: SubmitEvent) {
		e.preventDefault();
		if (sending || submission.unknown) {
			return;
		}
		const amount = sats * 1000;
		const zapSats = sats;
		const zapComment = comment;
		const zapMetadata = metadata;
		const zapItem = item;
		const zapPubkey = pubkey;
		let walletConnectUri: string | null;
		try {
			const storage = new WebStorage(localStorage);
			walletConnectUri = storage.get('nostr-wallet-connect');
		} catch {
			submission.error = $_('zap.failed');
			return;
		}
		await submission.submit({
			isOpen: () => open,
			failureMessage: $_('zap.failed'),
			prepareInvoice: async () => {
				const relays = Object.keys(rxNostr.getDefaultRelays({ filter: 'write-all' }));
				const zapRequest = nip57.makeZapRequest(
					zapItem === undefined
						? { pubkey: zapPubkey, amount, comment: zapComment, relays }
						: { event: zapItem.event, amount, comment: zapComment, relays }
				);
				const zapRequestEvent = await signEvent(zapRequest);
				const zapUrl = await zapMetadata?.zapUrl();
				if (!zapUrl) {
					throw new Error($_('zap.url_not_found'));
				}
				const url = new URL(zapUrl);
				url.searchParams.set('amount', String(amount));
				url.searchParams.set('nostr', JSON.stringify(zapRequestEvent));
				const response = await fetch(url);
				if (!response.ok) {
					throw new Error($_('zap.invoice_failed'));
				}
				const payment = await response.json();
				if (typeof payment?.pr !== 'string' || payment.pr.trim() === '') {
					throw new Error(
						typeof payment?.reason === 'string'
							? payment.reason
							: $_('zap.invoice_failed')
					);
				}
				$history = [zapSats, ...$history].slice(0, 100);
				return payment.pr;
			},
			pay: walletConnectUri
				? (invoice) => zapWithWalletConnect(walletConnectUri, invoice)
				: undefined,
			onPaid: () => {
				open = false;
				onZapped?.();
			}
		});
	}
</script>

<ModalDialog bind:open onclose={() => submission.reset()}>
	<article>
		<h1>{$_('zap.title')}</h1>
		{#if submission.unknown && !sending}
			<p role="alert">
				{#if submission.unknown.reason === 'invalid-response'}
					{$_('zap.invalid_response')}
				{/if}
				{$_('zap.payment_unknown')}
			</p>
			<button type="button" onclick={() => submission.confirmUnpaid()}>
				{$_('zap.confirm_unpaid')}
			</button>
		{/if}
		{#if submission.error}
			<p role="alert">{submission.error}</p>
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
			<form onsubmit={zap}>
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
				<input
					type="submit"
					value={$_('zap.send')}
					disabled={sending || !!submission.unknown}
				/>
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
