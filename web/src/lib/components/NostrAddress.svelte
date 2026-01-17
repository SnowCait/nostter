<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { nip05 } from 'nostr-tools';
	import type { Metadata } from '$lib/Items';
	import IconRosetteDiscountCheck from '@tabler/icons-svelte/icons/rosette-discount-check';
	import IconAlertTriangle from '@tabler/icons-svelte/icons/alert-triangle';

	interface Props {
		metadata: Metadata;
	}

	let { metadata }: Props = $props();

	let normalizedNip05 = $derived(metadata.normalizedNip05);
</script>

{#if normalizedNip05}
	<div class="nip05">
		<span>{normalizedNip05}</span>
		{#await nip05.queryProfile(normalizedNip05) then pointer}
			{#if pointer === null}
				<IconAlertTriangle color="orange" />
				<span class="label">{$_('profile.nip05.unknown')}</span>
			{:else if pointer.pubkey === metadata.event.pubkey}
				<IconRosetteDiscountCheck color="skyblue" />
			{:else}
				<IconAlertTriangle color="red" />
				<span class="label">{$_('profile.nip05.impersonation')}</span>
			{/if}
		{/await}
	</div>
{/if}

<style>
	.nip05 {
		margin: 0.35rem 0;
		display: inline-flex;
		flex-direction: row;
		align-items: center;
	}

	.nip05 span {
		margin-right: 0.2rem;
		word-break: break-all;
	}
</style>
