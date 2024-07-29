<script lang="ts">
	import IconLink from '@tabler/icons-svelte/icons/link';

	export let tag: string[];

	let url: URL | undefined;

	$: {
		try {
			url = new URL(tag[1]);
		} catch (error) {
			console.error('[proxy error]', tag);
		}
	}
</script>

{#if url !== undefined}
	<a href={url.href} target="_blank" rel="noopener noreferrer">
		<IconLink size="20" color="gray" />
		<span>{url.hostname}</span>
	</a>
{:else}
	<span>
		<IconLink size="20" color="gray" />
		<span>{tag.at(1) ?? '-'}</span>
	</span>
{/if}

<style>
	a {
		display: flex;
		flex-direction: row;
	}

	span {
		margin-left: 0.2rem;
	}
</style>
