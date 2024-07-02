<script lang="ts">
	import { metadataStore } from '$lib/cache/Events';
	import { alternativeName } from '$lib/Items';

	export let pubkey: string;

	$: metadata = $metadataStore.get(pubkey);
</script>

<span>{metadata?.displayName ?? alternativeName(pubkey)}</span>
{#if metadata !== undefined && metadata.displayName !== metadata.name}
	<span>@{metadata.name}</span>
{/if}
