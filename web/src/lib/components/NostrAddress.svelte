<script lang="ts">
	import { Badge } from '@svelteuidev/core';
	import { _ } from 'svelte-i18n';
	import { nip05, nip19 } from 'nostr-tools';
	import type { Metadata } from '$lib/Items';
	import CopyButton from './CopyButton.svelte';
	import IconRosetteDiscountCheck from '@tabler/icons-svelte/icons/rosette-discount-check';
	import IconAlertTriangle from '@tabler/icons-svelte/icons/alert-triangle';

	export let metadata: Metadata;

	$: npub = nip19.npubEncode(metadata.event.pubkey);
	$: nprofile = nip19.nprofileEncode({ pubkey: metadata.event.pubkey });
</script>

<details>
	<summary>
		{#if metadata.normalizedNip05}
			<div class="nip05">
				<span>{metadata.normalizedNip05}</span>
				{#await nip05.queryProfile(metadata.normalizedNip05) then pointer}
					{#if pointer === null}
						<IconAlertTriangle color="orange" />
						<Badge color="gray">{$_('profile.nip05.unknown')}</Badge>
					{:else if pointer.pubkey === metadata.event.pubkey}
						<IconRosetteDiscountCheck color="skyblue" />
					{:else}
						<IconAlertTriangle color="red" />
						<Badge color="gray">{$_('profile.nip05.impersonation')}</Badge>
					{/if}
				{/await}
			</div>
		{:else}
			<div class="nip05">
				<span>{npub.slice(0, 'npub1'.length + 7)}</span>
			</div>
		{/if}
	</summary>
	<div class="nip-19">
		<div>
			<span>{npub}</span>
			<CopyButton text={npub} />
		</div>
		<div>
			<span>{nprofile}</span>
			<CopyButton text={nprofile} />
		</div>
	</div>
</details>

<style>
	details {
		display: inline-block;
		margin: 0.35rem 0;
		color: var(--secondary-accent);
	}

	details .nip-19 span {
		overflow-x: hidden;
		text-overflow: ellipsis;
		font-size: 0.875rem;
		font-weight: 500;
		margin-top: 0.2rem;
		max-width: 240px;
	}

	details .nip-19 > div {
		display: flex;
	}

	.nip05 {
		display: inline-flex;
		flex-direction: row;
		align-items: center;
	}

	.nip05 span {
		margin-right: 0.2rem;
		word-break: break-all;
	}
</style>
