<script lang="ts">
	import { run } from 'svelte/legacy';

	import IconLink from '@tabler/icons-svelte/icons/link';

	interface Props {
		tag: string[];
	}

	let { tag }: Props = $props();

	let url: URL | undefined = $state();

	run(() => {
		try {
			url = new URL(tag[1]);
		} catch (error) {
			console.error('[proxy error]', tag, error);
		}
	});
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
