<script lang="ts">
	import { unfollowHashtag } from '$lib/Interest';

	interface Props {
		hashtag: string;
	}

	let { hashtag }: Props = $props();
</script>

<button onclick={() => unfollowHashtag(hashtag)}>Unfollow #{hashtag}</button>
