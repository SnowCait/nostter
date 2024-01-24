<script lang="ts">
	import { followHashtag } from '$lib/Interest';

	export let hashtag: string;
</script>

<button on:click={() => followHashtag(hashtag)}>Follow #{hashtag}</button>
