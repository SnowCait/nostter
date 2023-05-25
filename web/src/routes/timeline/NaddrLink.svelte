<script lang="ts">
	import { Kind, nip19 } from 'nostr-tools';

	export let kind: Kind;
	export let pubkey: string;
	export let identifier: string;
	export let relays: string[] | undefined = undefined;

	const naddr = nip19.naddrEncode({ kind, pubkey, identifier, relays });
</script>

<article class="timeline-item">
	<a href="/{naddr}">
		{naddr.substring(0, 'naddr1'.length + 7)}
	</a>
</article>
