<script lang="ts">
	import { nip19 } from 'nostr-tools';
	import type { Metadata } from '$lib/Items';
	import ProfileIcon from '$lib/components/profile/ProfileIcon.svelte';

	export let metadataList: (Metadata | undefined)[];
</script>

<ul class="clear">
	{#each metadataList as metadata}
		<li>
			{#if metadata !== undefined}
				<a href="/{nip19.nprofileEncode({ pubkey: metadata.event.pubkey })}">
					<ProfileIcon pubkey={metadata.event.pubkey} width="30px" height="30px" />
				</a>
			{/if}
		</li>
	{/each}
</ul>

<style>
	ul {
		display: flex;
		flex-direction: row;
		flex-wrap: wrap;
		margin: 0.2rem 0;
	}
</style>
