<script lang="ts">
	import { metadataStore } from '$lib/cache/Events';
	import { alternativeName } from '$lib/Items';
	import EmojifiedContent from '../EmojifiedContent.svelte';

	export let pubkey: string;
	export let displayNameOnly: boolean = false;

	$: metadata = $metadataStore.get(pubkey);
</script>

<span class="display_name">
	{#if metadata !== undefined}
		<EmojifiedContent content={metadata.displayName} tags={metadata.event.tags} />
	{:else}
		<span>{alternativeName(pubkey)}</span>
	{/if}
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
