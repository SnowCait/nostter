<script lang="ts">
	import { followHashtag } from '$lib/Interest';

	interface Props {
		hashtag: string;
	}

	let { hashtag }: Props = $props();
</script>

<button onclick={() => followHashtag(hashtag)}>Follow #{hashtag}</button>
