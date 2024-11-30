<script lang="ts">
	import Img from './Img.svelte';

	export let tag: string[];

	$: url = tag.at(1)?.split(' ').at(1) ?? '';
</script>

{#if URL.canParse(url)}
	<Img url={new URL(url)} />
{/if}
