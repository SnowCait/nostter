<script lang="ts">
	import { emojify } from '$lib/Content';
	import CustomEmoji from './content/CustomEmoji.svelte';

	interface Props {
		content: string;
		tags: string[][];
	}

	let { content, tags }: Props = $props();
</script>

{#each emojify(content, tags) as token}
	{#if token.type === 'text'}
		<span>{token.text}</span>
	{:else if token.type === 'emoji' && token.url}
		<CustomEmoji text={token.text} url={token.url} />
	{/if}
{/each}
