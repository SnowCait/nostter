<script lang="ts">
	import { nip57 } from 'nostr-tools';
	import QRCode from 'qrcode';
	import { writeRelays } from '../stores/Author';
	import { createEventDispatcher, onMount } from 'svelte';
	import { WebStorage } from '$lib/WebStorage';
	import { Signer } from '$lib/Signer';
	import type { EventItem } from '$lib/Items';
	import { metadataStore } from '$lib/cache/Events';
	import ModalDialog from '$lib/components/ModalDialog.svelte';

	export let eventItem: EventItem;

	$: metadata = $metadataStore.get(eventItem.event.pubkey);

	export function openZapDialog() {
		console.log('[zap open]');
		open = true;
	}

	let sats = 50;
	let zapComment = '';
	let invoice = '';
	let open = false;

	const dispatch = createEventDispatcher();

	onMount(() => {
		const storage = new WebStorage(localStorage);
		const previousSats = storage.get('zap');
		if (previousSats !== null) {
			sats = Number(previousSats);
		}
	});

	async function zap() {
		const amount = sats * 1000;
		const zapRequest = nip57.makeZapRequest({
			profile: eventItem.event.pubkey,
			event: eventItem.event.id,
			amount,
			comment: zapComment,
			relays: $writeRelays
		});
		const zapRequestEvent = await Signer.signEvent(zapRequest);
		console.log('[zap request]', zapRequestEvent, metadata?.content);
		const encoded = encodeURI(JSON.stringify(zapRequestEvent));

		const zapUrl = (await metadata?.zapUrl()) ?? null;
		if (zapUrl === null) {
			console.error('[zap url not found]', metadata?.content?.lud16);
			return;
		}
		const url = `${zapUrl.href}?amount=${amount}&nostr=${encoded}`;
		console.log('[zap url]', url);

		const response = await fetch(url);
		if (!response.ok) {
			console.error('[zap failed]', await response.text());
			return;
		}
		const { pr } = await response.json();
		invoice = pr;
		console.log('[zap invoice]', invoice);

		const storage = new WebStorage(localStorage);
		storage.set('zap', sats.toString());

		dispatch('zapped');
	}
</script>

<ModalDialog bind:open>
	<article>
		{#if invoice === ''}
			<div>
				@{metadata?.content?.name ?? metadata?.content?.display_name}
			</div>
			<form on:submit|preventDefault={zap}>
				<div>
					<input
						type="number"
						bind:value={sats}
						on:keyup|stopPropagation={() => console.debug}
					/>
					<input type="submit" value="Zap" />
				</div>
				<div>
					<input
						type="text"
						placeholder="Comment"
						bind:value={zapComment}
						on:keyup|stopPropagation={() => console.debug}
					/>
				</div>
			</form>
		{:else}
			<section class="lnbc">
				<div>
					{#await QRCode.toDataURL(`lightning:${invoice}`) then dataUrl}
						<a href="lightning:{invoice}" target="_blank" rel="noopener noreferrer">
							<img src={dataUrl} alt="" />
						</a>
					{/await}
				</div>
				<div class="text">{invoice}</div>
			</section>
		{/if}
	</article>
</ModalDialog>

<style>
	article {
		margin: 1rem;
	}

	.lnbc .text {
		max-width: 400px;
		overflow: auto;
	}
</style>
