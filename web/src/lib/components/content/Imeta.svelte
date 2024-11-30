<script lang="ts">
	import Img from './Img.svelte';

	export let tag: string[];

	$: url = tag.find((entry) => entry.startsWith('url '))?.substring('url '.length) ?? '';
</script>

{#if URL.canParse(url)}
	<Img url={new URL(url)} />
{/if}
