<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { follow, unfollow } from '$lib/author/Follow';
	import { auth } from '$lib/auth.svelte';
	import { metadataStore } from '$lib/cache/Events';
	import { alternativeName } from '$lib/Items';
	import type { Signer } from '$lib/nostr/signing/signer';
	import { followingPubkeys } from '$lib/stores/Author';

	interface Props {
		pubkey: string;
	}

	let { pubkey }: Props = $props();

	let processing = $state(false);

	async function signEvent(template: Parameters<Signer['signEvent']>[0]) {
		const signer = auth.signer;
		if (signer === undefined) {
			throw new Error('Cannot sign an event without a signing session');
		}

		return signer.signEvent(template);
	}

	async function onFollow() {
		console.log('[follow]');

		processing = true;

		try {
			await follow(signEvent, [pubkey]);
		} catch (error) {
			console.error('[follow failed]', error);
			alert('Failed to follow.');
		}

		processing = false;
	}

	async function onUnfollow() {
		console.log('[unfollow]');

		const metadata = $metadataStore.get(pubkey);

		if (!confirm(`Unfollow @${metadata?.displayName ?? alternativeName(pubkey)}?`)) {
			console.log('Unfollow is cancelled');
			return;
		}

		processing = true;

		try {
			await unfollow(signEvent, [pubkey]);
		} catch (error) {
			console.error('[unfollow failed]', error);
			alert('Failed to unfollow.');
		}

		processing = false;
	}
</script>

{#if $followingPubkeys.includes(pubkey)}
	<button onclick={onUnfollow} class="rounded-button" disabled={processing}>
		{$_('follow.following')}
	</button>
{:else}
	<button onclick={onFollow} class="rounded-button primary" disabled={processing}>
		{$_('follow.follow')}
	</button>
{/if}

<style>
	button {
		display: flex;
		row-gap: 2px;
	}

	:global(button .loader > svg) {
		fill: white;
	}
</style>
