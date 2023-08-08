<script lang="ts">
	import { notFoundImageUrl, onImageError } from '$lib/Constants';
	import type { Metadata } from '$lib/Items';
	import { nip19 } from 'nostr-tools';

	export let metadata: Metadata;

	$: name = metadata.content?.display_name ?? '@' + metadata.content?.name;
</script>

<article>
	<a href="/{nip19.npubEncode(metadata.event.pubkey)}">
		<img
			src={metadata.content?.picture ?? notFoundImageUrl}
			alt={name}
			title={name}
			on:error={onImageError}
		/>
	</a>
</article>

<style>
	img {
		width: 30px;
		height: 30px;
		border-radius: 50%;
		object-fit: cover;
	}
</style>
