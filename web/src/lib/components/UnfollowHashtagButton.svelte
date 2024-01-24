<script lang="ts">
	import { unfollowHashtag } from '$lib/Interest';

	export let hashtag: string;
</script>

<button on:click={() => unfollowHashtag(hashtag)}>Unfollow #{hashtag}</button>
