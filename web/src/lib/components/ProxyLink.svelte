<script lang="ts">
	import { run } from 'svelte/legacy';

	import IconLink from '@tabler/icons-svelte-runes/icons/link';

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
	<span class="fallback">
		<IconLink size="20" color="gray" />
		<span>{tag.at(1) ?? '-'}</span>
	</span>
{/if}

<style>
	a,
	.fallback {
		display: flex;
		flex-direction: row;
		align-items: center;
	}

	a span,
	.fallback span {
		margin-left: 0.2rem;
	}
</style>
