<script lang="ts">
	import { alternativeName, type Metadata } from '$lib/Items';

	export let metadata: Metadata;
</script>

<span>{metadata.displayName ?? alternativeName(metadata.event.pubkey)}</span>
{#if metadata.displayName !== metadata.name}
	<span>@{metadata.name}</span>
{/if}
