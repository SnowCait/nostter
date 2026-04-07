<script lang="ts">
	import { _ } from 'svelte-i18n';
	import CustomEmoji from './CustomEmoji.svelte';
	import { Popover } from 'melt/builders';
	import { rom } from '$lib/stores/Author';
	import { sendReaction } from '$lib/author/Reaction';
	import type { Event } from 'nostr-typedef';

	interface Props {
		text?: string;
		url: string;
		event?: Event;
	}

	let { text = '', url, event }: Props = $props();

	const popover = new Popover();

	async function reaction(): Promise<void> {
		// Workaround for inconsistent shortcodes
		await sendReaction(event!, text.startsWith(':') ? text : `:${text}:`, url);
		popover.open = false;
	}
</script>

<button class="clear" {...popover.trigger}>
	<CustomEmoji {text} {url} />
</button><!-- Workaround to eliminate extra whitespace -->{#if popover.open}
	<div {...popover.content} class="popover">
		<div {...popover.arrow}></div>

		<img src={url} alt={text} title={text} />

		{#if event && !$rom}
			<button onclick={reaction}>{$_('actions.reaction.same')}</button>
		{/if}
	</div>
{/if}

<style>
	button {
		display: inline;
	}

	.popover {
		color: var(--surface-foreground);
		background-color: var(--surface);
		border: var(--default-border);
		border-radius: var(--radius);
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.popover > * {
		margin: 0 auto;
	}

	img {
		max-height: 3rem;
	}
</style>
