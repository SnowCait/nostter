<script lang="ts">
	import { run, preventDefault, createBubbler, stopPropagation } from 'svelte/legacy';

	const bubble = createBubbler();
	import { nip57 } from 'nostr-tools';
	import type { Event } from 'nostr-typedef';
	import QRCode from 'qrcode';
	import { writeRelays } from '$lib/stores/Author';
	import { createEventDispatcher } from 'svelte';
	import { persistedStore, WebStorage } from '$lib/WebStorage';
	import { Signer } from '$lib/Signer';
	import { zapWithWalletConnect } from '$lib/Zap';
	import { metadataStore } from '$lib/cache/Events';
	import ModalDialog from '$lib/components/ModalDialog.svelte';
	import { EventItem } from '$lib/Items';
	import EventComponent from './items/EventComponent.svelte';
	import ProfileIcon from './profile/ProfileIcon.svelte';
	import ProfileName from './profile/ProfileName.svelte';
	import { _ } from 'svelte-i18n';
	import { browser } from '$app/environment';

	interface Props {
		pubkey: string;
		event: Event | undefined;
	}

	let { pubkey, event }: Props = $props();

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

	run(() => {
		if (browser) {
			const counts = new Map<number, number>();
			for (const value of $history) {
				counts.set(value, (counts.get(value) ?? 0) + 1);
			}
			satsList = [...counts].toSorted(([, x], [, y]) => y - x).map(([value]) => value);
		}
	});

	const dispatch = createEventDispatcher();

	async function zap() {
		sending = true;

		const amount = sats * 1000;
		const relays = $writeRelays;
		const zapRequest = nip57.makeZapRequest(
			event === undefined
				? { pubkey, amount, comment, relays }
				: { event, amount, comment, relays }
		);
		const zapRequestEvent = await Signer.signEvent(zapRequest);
		console.debug('[zap request]', zapRequestEvent, metadata?.content);
		const encoded = encodeURI(JSON.stringify(zapRequestEvent));

		const zapUrl = (await metadata?.zapUrl()) ?? null;
		if (zapUrl === null) {
			console.error('[zap url not found]', metadata?.content?.lud16);
			return;
		}
		const url = `${zapUrl.href}?amount=${amount}&nostr=${encoded}`;
		console.debug('[zap url]', url);

		const response = await fetch(url);
		if (!response.ok) {
			console.error('[zap failed]', await response.text());
			return;
		}
		const payment = await response.json();
		const { pr: zapInvoice } = payment;
		console.debug('[zap invoice]', zapInvoice);

		if (zapInvoice === undefined) {
			console.error('[zap failed]', payment);
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
					dispatch('zapped');
					return;
				}
			} catch (error) {
				console.error('[NWC error]', error);
			}
		}

		invoice = zapInvoice;
		dispatch('zapped');
	}
</script>

<ModalDialog bind:open>
	<article>
		<h1>{$_('zap.title')}</h1>
		{#if invoice === ''}
			<blockquote>
				{#if event}
					<EventComponent item={new EventItem(event)} readonly={true} />
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
			<form onsubmit={preventDefault(zap)}>
				<div class="sats-input">
					{#each satsList.slice(0, 5) as value}
						<button type="button" onclick={() => (sats = value)}>
							{value.toLocaleString()}
						</button>
					{/each}
				</div>
				<div>
					<input
						type="number"
						bind:value={sats}
						onkeyup={stopPropagation(bubble('keyup'))}
					/>
					<span>sats</span>
				</div>
				<div>
					<input
						type="text"
						placeholder={$_('zap.message')}
						bind:value={comment}
						onkeyup={stopPropagation(bubble('keyup'))}
					/>
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

	input[type='text'] {
		width: 100%;
		font-size: 1rem;
	}

	input[type='number'] {
		font-size: 1rem;
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
