<script lang="ts">
	import CustomEmoji from './CustomEmoji.svelte';
	import { Popover } from 'melt/builders';

	interface Props {
		text?: string;
		url: string;
	}

	let { text = '', url }: Props = $props();

	const popover = new Popover();
</script>

<button class="clear" {...popover.trigger}>
	<CustomEmoji {text} {url} />
</button><!-- Workaround to eliminate extra whitespace -->{#if popover.open}
	<div {...popover.content} class="popover">
		<div {...popover.arrow}></div>

		<img src={url} alt={text} title={text} />
	</div>
{/if}

<style>
	button {
		display: inline;
	}

	.popover {
		border: var(--default-border);
		border-radius: var(--radius);
		padding: 1rem;
	}

	img {
		max-width: 3rem;
		max-height: 3rem;
	}
</style>
