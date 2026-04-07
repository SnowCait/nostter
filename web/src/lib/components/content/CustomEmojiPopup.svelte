<script lang="ts">
	import { _ } from 'svelte-i18n';
	import CustomEmoji from './CustomEmoji.svelte';
	import { Popover } from 'melt/builders';
	import { rom } from '$lib/stores/Author';
	import { sendReaction } from '$lib/author/Reaction';
	import type { Event } from 'nostr-typedef';
	import { developerMode } from '$lib/stores/Preference';

	interface Props {
		text?: string;
		url: string;
		address?: string; // kind 30030 address
		event?: Event;
	}

	let { text = '', url, address, event }: Props = $props();

	// Workaround for inconsistent shortcodes
	let shortcode = $derived(text.startsWith(':') ? text : `:${text}:`);

	const popover = new Popover();

	async function reaction(): Promise<void> {
		await sendReaction(event!, shortcode, url);
		popover.open = false;
	}
</script>

<button class="clear" {...popover.trigger}>
	<CustomEmoji {text} {url} />
</button><!-- Workaround to eliminate extra whitespace -->{#if popover.open}
	<div {...popover.content} class="popover">
		<div {...popover.arrow}></div>

		<img src={url} alt={text} title={text} />

		{#if $developerMode}
			<div>{shortcode}</div>
			<div>{address}</div>
		{/if}

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
