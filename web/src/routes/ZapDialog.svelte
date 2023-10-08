<script lang="ts">
	import { nip57 } from 'nostr-tools';
	import QRCode from 'qrcode';
	import { writeRelays } from '../stores/Author';
	import { createEventDispatcher } from 'svelte';
	import { Signer } from '$lib/Signer';
	import type { User } from './types';
	import type { EventItem } from '$lib/Items';

	export let eventItem: EventItem;

	export function openZapDialog() {
		console.log('[zap open]');
		dialog.showModal();
	}

	let sats = 50;
	let zapComment = '';
	let invoice = '';
	let dialog: HTMLDialogElement;

	const dispatch = createEventDispatcher();

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
		console.log('[zap request]', zapRequestEvent, eventItem.metadata?.content);
		const encoded = encodeURI(JSON.stringify(zapRequestEvent));

		const zapUrl = (await eventItem.metadata?.zapUrl()) ?? null;
		if (zapUrl === null) {
			console.error('[zap url not found]', eventItem.metadata?.content?.lud16);
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

		dispatch('zapped');
	}

	function closeZapDialog(e: MouseEvent) {
		const element = (e.target as Element).closest('.zap-dialog');
		console.log('[zap close]', element, dialog);
		if (element === null) {
			dialog.close();
		}
	}
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<dialog bind:this={dialog} on:click={closeZapDialog}>
	<div class="zap-dialog">
		{#if invoice === ''}
			<div>
				@{eventItem.metadata?.content?.name ?? eventItem.metadata?.content?.display_name}
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
	</div>
</dialog>

<style>
	dialog {
		padding: 0;
		border: 1px;
		border-style: solid;
		border-color: lightgray;
		border-radius: 10px;
	}

	.zap-dialog {
		padding: 1em;
	}

	.lnbc .text {
		max-width: 400px;
		overflow: auto;
	}
</style>
