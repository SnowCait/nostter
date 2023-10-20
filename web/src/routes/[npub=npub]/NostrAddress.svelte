<script lang="ts">
	import { nip05, nip19 } from "nostr-tools";
	import type { Metadata } from "$lib/Items";
	import CopyButton from '../parts/CopyButton.svelte';
	import IconDiscountCheck from '@tabler/icons-svelte/dist/svelte/icons/IconDiscountCheck.svelte';
	import IconAlertTriangle from '@tabler/icons-svelte/dist/svelte/icons/IconAlertTriangle.svelte';

	export let metadata: Metadata;
	export let slug: string;

	$: npub = nip19.npubEncode(metadata.event.pubkey);
	$: nprofile = nip19.nprofileEncode({pubkey: metadata.event.pubkey});
</script>

<details>
	<summary>
		{#if metadata.content?.nip05}
			<div class="nip05">
				<span>{slug}</span>
				{#await nip05.queryProfile(metadata.content.nip05) then pointer}
					{#if pointer !== null}
						<IconDiscountCheck color="skyblue" />
					{:else}
						<IconAlertTriangle color="red" />
					{/if}
				{/await}
			</div>
		{:else}
			<div>
				<span>{npub}</span>
			</div>
		{/if}
	</summary>
	<div class="nip-19">
		{#if metadata.content?.nip05}
			<div>
				<span>{npub}</span>
				<CopyButton text={npub} />
			</div>
		{/if}
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
	}

	.nip05 span {
		margin-right: 0.2rem;
	}
</style>
