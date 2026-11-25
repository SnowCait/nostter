<script lang="ts">
	import ProfileDisplayName from '$lib/components/profile/ProfileDisplayName.svelte';
	import { metadataStore } from '$lib/cache/Events';
	import EmojifiedContent from '../EmojifiedContent.svelte';

	interface Props {
		pubkey: string;
		displayNameOnly?: boolean;
	}

	let { pubkey, displayNameOnly = false }: Props = $props();

	let metadata = $derived($metadataStore.get(pubkey));
</script>

<span class="display_name">
	<ProfileDisplayName {pubkey} {metadata} />
</span>
{#if !displayNameOnly && metadata !== undefined && metadata.displayName !== metadata.name}
	<span class="name">
		<span>@</span>
		<EmojifiedContent content={metadata.name} tags={metadata.event.tags} />
	</span>
{/if}

<style>
	.display_name,
	.name {
		display: inline-flex;
	}
</style>
