<script lang="ts">
	import { followHashtag } from '$lib/Interest';
	import type { Signer } from '$lib/nostr/signing/signer';

	interface Props {
		hashtag: string;
		signEvent: Signer['signEvent'];
	}

	let { hashtag, signEvent }: Props = $props();
</script>

<button onclick={() => followHashtag(signEvent, hashtag)}>Follow #{hashtag}</button>
