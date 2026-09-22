<script lang="ts">
	import { unfollowHashtag } from '$lib/Interest';
	import type { Signer } from '$lib/nostr/signing/signer';

	interface Props {
		hashtag: string;
		signEvent: Signer['signEvent'];
	}

	let { hashtag, signEvent }: Props = $props();
</script>

<button onclick={() => unfollowHashtag(signEvent, hashtag)}>Unfollow #{hashtag}</button>
