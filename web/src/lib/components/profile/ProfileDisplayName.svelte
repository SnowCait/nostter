<script lang="ts">
	import type { Metadata } from '$lib/Items';
	import { resolveProfileDisplayName } from './profile-display-name';
	import EmojifiedContent from '../EmojifiedContent.svelte';

	let { pubkey, metadata }: { pubkey: string; metadata: Metadata | undefined } = $props();

	let name = $derived(resolveProfileDisplayName(pubkey, metadata));
</script>

{#if name.tags !== undefined}
	<EmojifiedContent content={name.text} tags={name.tags} />
{:else}
	<span>{name.text}</span>
{/if}
