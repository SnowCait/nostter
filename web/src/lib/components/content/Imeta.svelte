<script lang="ts">
	import Img from './Img.svelte';

	interface Props {
		tag: string[];
	}

	let { tag }: Props = $props();

	let url = $derived(tag.find((entry) => entry.startsWith('url '))?.substring('url '.length) ?? '');
</script>

{#if URL.canParse(url)}
	<Img url={new URL(url)} />
{/if}
