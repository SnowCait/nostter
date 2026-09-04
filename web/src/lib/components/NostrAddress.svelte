<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { nip05 } from 'nostr-tools';
	import type { Metadata } from '$lib/Items';
	import IconRosetteDiscountCheck from '@tabler/icons-svelte-runes/icons/rosette-discount-check';
	import IconAlertTriangle from '@tabler/icons-svelte-runes/icons/alert-triangle';

	interface Props {
		metadata: Metadata;
	}

	let { metadata }: Props = $props();

	let normalizedNip05 = $derived(metadata.normalizedNip05);
</script>

{#if normalizedNip05}
	<div class="nip05">
		<span class="address">{normalizedNip05}</span>
		{#await nip05.queryProfile(normalizedNip05) then pointer}
			{#if pointer === null}
				<span class="status">
					<IconAlertTriangle color="orange" />
					<span class="label">{$_('profile.nip05.unknown')}</span>
				</span>
			{:else if pointer.pubkey === metadata.event.pubkey}
				<span class="status">
					<IconRosetteDiscountCheck color="skyblue" />
				</span>
			{:else}
				<span class="status">
					<IconAlertTriangle color="red" />
					<span class="label">{$_('profile.nip05.impersonation')}</span>
				</span>
			{/if}
		{/await}
	</div>
{/if}

<style>
	.nip05 {
		margin: 0.35rem 0;
		display: inline-flex;
		align-items: flex-start;
		gap: 0.2rem;
		max-width: 100%;
	}

	.address {
		min-width: 0;
		overflow-wrap: anywhere;
	}

	.status {
		display: inline-flex;
		flex: none;
		align-items: center;
		gap: 0.2rem;
		white-space: nowrap;
	}
</style>
