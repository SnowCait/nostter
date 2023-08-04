<script lang="ts">
	import type { Metadata } from '$lib/Items';
	import { nip19 } from 'nostr-tools';

	export let metadata: Metadata;

	$: name = metadata.content?.display_name ?? '@' + metadata.content?.name;
</script>

<article>
	<a href="/{nip19.npubEncode(metadata.event.pubkey)}">
		<img src={metadata.content?.picture} alt={name} title={name} />
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
