<script lang="ts">
	import { metadataStore } from '$lib/cache/Events';
	import { alternativeName } from '$lib/Items';
	import ProfileIcon from './ProfileIcon.svelte';
	import ProfileName from './ProfileName.svelte';

	export let pubkey: string;

	$: metadata = $metadataStore.get(pubkey);
</script>

{#if metadata !== undefined}
	<ProfileIcon {metadata} width="1.2rem" height="1.2rem" />
	<ProfileName {metadata} />
{:else}
	<span>{alternativeName(pubkey)}</span>
{/if}
